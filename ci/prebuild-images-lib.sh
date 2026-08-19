# Helpers for producing ROR plugin dev images: trigger the pre-build workflow in a plugin repo, wait
# for that run to finish, then check that the images it published are in the registry.
#
# Sourced, not executed.
#
# Needs `gh` and `jq` to dispatch and to follow the run, and `docker` to probe the registry, each
# only when the matching function is called.
#
# Nothing relies on the caller using `set -e`: every function returns non-zero on failure, and the
# ones that call others pass that status on with `|| return $?`.
#
# CONTRACT FOR CALLERS IN OTHER REPOS
# The ROR ES repo and the ROR KBN repo clone this repo when they run, source this file, and call it
# from two different jobs. What follows is what the two sides owe each other, and it is the only
# part a caller may depend on. The steps inside these functions are not part of it. They change here,
# and a caller must not copy them into its own documentation.
#
# A caller supplies:
#   * one dispatch, for the whole version list, from a job of its own:
#     dispatch_<es|kbn>_prebuild_image <versions> <target branch> <run tag>.
#   * the run the dispatch identified. It leaves the run in ROR_<ES|KBN>_PREBUILD_RUN_ID and
#     ROR_<ES|KBN>_PREBUILD_RUN_URL. The waiting jobs are other processes on other machines, so the
#     caller carries both values to them, usually as job outputs.
#   * a GitHub token for the plugin repo, in ES_REPO_GH_TOKEN or KBN_REPO_GH_TOKEN. It must be able
#     to dispatch a workflow and to read the runs of that repo.
#   * an authenticated docker CLI in every waiting job. Each repo has its own docker-hub-auth.sh.
#   * ROR_<ES|KBN>_WAIT_TIMEOUT_SECONDS, when one run builds several versions and thus takes longer
#     than the default for one.
#   * a title on the pre-build run, which the plugin repo owns:
#         run-name: ROR <ES|KBN> pre-build ${{ inputs.tag }}
#     A dispatch is not told which run it created, so the search after it matches this title. Without
#     the line, two dispatches in the same minute cannot be told apart, and this repo refuses to guess
#     between them.
#
# In return:
#   * wait_for_<es|kbn>_prebuild_images returns 0 only when every image it was asked for is in the
#     registry and can be pulled by tag.
#   * it stops as soon as the pre-build run fails, and it names that run.
#   * it reports a failure by its cause, and never as a bare timeout. The causes are the return
#     codes listed on wait_for_plugin_prebuild_images.
#   * it costs few Docker Hub pulls, and none of them while the build runs.
#
# One consequence reaches into the caller's own design: the wait ends when the RUN ends, and not when
# one image appears. A caller with one job per version starts them all at about the same time.

# Do nothing if this file was already sourced.
if [ -n "${_ROR_PREBUILD_IMAGES_LIB_SOURCED:-}" ]; then
  return 0 2>/dev/null || true
fi
_ROR_PREBUILD_IMAGES_LIB_SOURCED=1

# --- Coordinates -------------------------------------------------------------------------------
# Every value below can be overridden from the environment; the defaults are the real ones.

# Each plugin publishes its pre-build images from a manually-triggered GitHub Actions workflow.
ROR_KBN_GH_REPO="${ROR_KBN_GH_REPO:-sscarduzio/readonlyrest_kbn}"
ROR_KBN_PUBLISH_WORKFLOW="${ROR_KBN_PUBLISH_WORKFLOW:-publish-pre-builds.yml}"

ROR_ES_GH_REPO="${ROR_ES_GH_REPO:-sscarduzio/elasticsearch-readonlyrest-plugin}"
ROR_ES_PUBLISH_WORKFLOW="${ROR_ES_PUBLISH_WORKFLOW:-publish-pre-builds.yml}"

# Which ref the workflow file itself is read from. That is a different thing from which sources get
# built, which is the target branch passed to the workflow as an input. It matters when the workflow
# is being changed on a branch, so that the branch's own copy runs.
#
# "auto" uses the target branch when it exists in the plugin repo, otherwise the fallback ref below.
# Set a literal ref to pin one, or empty to let gh use the repo's default branch.
#
# This cannot make an unregistered workflow dispatchable: GitHub only allows dispatching a workflow
# whose file is on the repo's default branch, and gh looks it up there before applying --ref.
ROR_ES_PUBLISH_WORKFLOW_REF="${ROR_ES_PUBLISH_WORKFLOW_REF-auto}"
ROR_KBN_PUBLISH_WORKFLOW_REF="${ROR_KBN_PUBLISH_WORKFLOW_REF-auto}"
ROR_ES_PUBLISH_WORKFLOW_FALLBACK_REF="${ROR_ES_PUBLISH_WORKFLOW_FALLBACK_REF:-develop}"
ROR_KBN_PUBLISH_WORKFLOW_FALLBACK_REF="${ROR_KBN_PUBLISH_WORKFLOW_FALLBACK_REF:-develop}"

ROR_ES_DEV_IMAGE_REPO="${ROR_ES_DEV_IMAGE_REPO:-beshultd/elasticsearch-readonlyrest-dev}"
ROR_KBN_DEV_IMAGE_REPO="${ROR_KBN_DEV_IMAGE_REPO:-beshultd/kibana-readonlyrest-dev}"

# How long to wait for a pre-build run to finish before giving up. ES gets the longer limit because
# its build takes longer than the Kibana one.
ROR_ES_WAIT_TIMEOUT_SECONDS="${ROR_ES_WAIT_TIMEOUT_SECONDS:-$((45 * 60))}"
ROR_KBN_WAIT_TIMEOUT_SECONDS="${ROR_KBN_WAIT_TIMEOUT_SECONDS:-$((30 * 60))}"

# How often to ask GitHub if the pre-build run has finished. This wait lasts for the whole build, and
# it costs no Docker Hub pulls. GitHub allows 1000 API requests per hour for one repository, and a
# 45-minute wait at this interval uses 135 of them.
ROR_PREBUILD_RUN_POLL_INTERVAL_SECONDS="${ROR_PREBUILD_RUN_POLL_INTERVAL_SECONDS:-20}"

# How many times to ask the registry for one tag after the run has succeeded, and how long to wait
# between two attempts.
#
# Every attempt costs one pull: `docker manifest inspect` sends a GET, and Docker Hub counts a GET
# against the pull rate limit. The job logs in first, with .github/scripts/docker-hub-auth.sh, so the
# pulls count against the ROR account (200 per 6h), not against the runner address (100 per 6h) that
# all GitHub customers share.
#
# The pre-build run pushes every tag before it reports success, so the first attempt normally finds
# the image. Four versions of two plugins therefore cost 8 pulls, or 24 if every image needs all
# three attempts. The later attempts cover only the short gap between the push and the tag becoming
# readable.
ROR_PREBUILD_IMAGE_CHECK_ATTEMPTS="${ROR_PREBUILD_IMAGE_CHECK_ATTEMPTS:-3}"
ROR_PREBUILD_IMAGE_CHECK_INTERVAL_SECONDS="${ROR_PREBUILD_IMAGE_CHECK_INTERVAL_SECONDS:-30}"

# --- Image reference helpers -------------------------------------------------------------------

# Full image reference for a dev image, given a stack version and a tag.
ror_es_dev_image() { echo "${ROR_ES_DEV_IMAGE_REPO}:${1}-ror-${2}"; }
ror_kbn_dev_image() { echo "${ROR_KBN_DEV_IMAGE_REPO}:${1}-ror-${2}"; }

# Whatever the last _probe_dev_image call failed with. Kept so the wait loop can report the real
# reason instead of a bare timeout.
ROR_PREBUILD_LAST_PROBE_ERROR=""

# Asks the registry whether a tag exists, without pulling it. Returns:
#   0 - the tag is there
#   1 - the registry answered and the tag is not there
#   2 - the question could not be asked: rate limit, auth, network, or a repo name that does not
#       resolve
#
# Telling 1 and 2 apart is the whole point. Both look like "not published yet" to a plain
# `docker manifest inspect >/dev/null 2>&1`, so a throttled or unauthorised probe blames the plugin
# workflow for something that happened here.
_probe_dev_image() {
  local IMAGE=$1 OUTPUT STATUS=0

  OUTPUT=$(docker manifest inspect "$IMAGE" 2>&1) || STATUS=$?
  ROR_PREBUILD_LAST_PROBE_ERROR=""
  [ "$STATUS" -eq 0 ] && return 0

  ROR_PREBUILD_LAST_PROBE_ERROR=$OUTPUT

  # A missing tag is worded differently depending on the registry and the CLI version; anything else
  # (`toomanyrequests`, `unauthorized`, `denied`, a DNS or TLS error) means the probe itself failed.
  case "$OUTPUT" in
    *"manifest unknown"* | *"no such manifest"* | *"not found"* | *MANIFEST_UNKNOWN*) return 1 ;;
  esac
  return 2
}

# Checks whether an image tag exists in the remote registry without pulling it. Kept for callers that
# only want a yes/no; use _probe_dev_image when the reason matters.
docker_image_exists() {
  local STATUS=0
  _probe_dev_image "$1" || STATUS=$?
  [ "$STATUS" -eq 0 ]
}

# The pre-build run each dispatch started, so the wait can follow it. Empty until dispatched, and
# empty for a wait that runs without a dispatch in the same shell.
ROR_ES_PREBUILD_RUN_ID="${ROR_ES_PREBUILD_RUN_ID:-}"
ROR_ES_PREBUILD_RUN_URL="${ROR_ES_PREBUILD_RUN_URL:-}"
ROR_KBN_PREBUILD_RUN_ID="${ROR_KBN_PREBUILD_RUN_ID:-}"
ROR_KBN_PREBUILD_RUN_URL="${ROR_KBN_PREBUILD_RUN_URL:-}"

# Turns a space- or comma-separated version list into space-separated tokens, and rejects anything
# that is not X.Y.Z or X.Y.Z-qualifier.
normalize_elk_versions() {
  if [ "$#" -lt 1 ] || [ -z "${1// /}" ]; then
    echo "ERROR: no ELK versions given" >&2
    return 1
  fi

  local VERSIONS
  VERSIONS=$(echo "$1" | tr ',' ' ' | tr -s '[:space:]' ' ' | sed 's/^ //; s/ $//')

  local VERSION
  for VERSION in $VERSIONS; do
    if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)?$ ]]; then
      echo "ERROR: invalid ELK version '$VERSION'. Expected format: X.Y.Z" >&2
      return 2
    fi
  done

  echo "$VERSIONS"
}

# --- Dispatch ----------------------------------------------------------------------------------
#
# Dispatching only queues the workflow and returns; use the wait helpers below to block on the
# result.
#
# It is safe to dispatch even when the image already exists. The workflow skips the build when the
# sources have not changed and only re-tags the image it already published.
#
# The target branch does not have to exist in the plugin repo — the workflow falls back to `develop`
# — so the current branch name can always be passed as it is.
#
# Versions may be passed as a list, so one dispatch can cover several versions.

# An ISO8601 UTC timestamp N minutes in the past, for filtering `gh run list` output. Goes through
# epoch arithmetic because GNU (`date -d @epoch`) and BSD (`date -r epoch`) spell the same thing
# differently and this file runs on both.
_iso8601_minutes_ago() {
  local EPOCH
  EPOCH=$(( $(date -u +%s) - $1 * 60 ))
  date -u -d "@$EPOCH" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null ||
    date -u -r "$EPOCH" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null
}

# One look for the run that carries a given title, among the runs of one workflow that started since
# we asked. Echoes "<run id> <run url>", or nothing when there is no such run yet — which is also what
# a failed request or a failed parse gives, and the caller retries either way.
#
# Comparing the timestamps as strings is exact: gh and `date` above both emit YYYY-MM-DDTHH:MM:SSZ,
# which sorts lexicographically.
# Usage: _prebuild_run_by_title <repo> <workflow> <token> <created-since ISO8601> <title>
_prebuild_run_by_title() {
  local REPO=$1 WORKFLOW=$2 TOKEN=$3 SINCE=$4 TITLE=$5
  GH_TOKEN="$TOKEN" gh run list -R "$REPO" --workflow "$WORKFLOW" --limit 20 \
    --json databaseId,url,createdAt,displayTitle 2>/dev/null |
    jq -r --arg since "$SINCE" --arg title "$TITLE" \
      '[.[] | select(.createdAt >= $since and .displayTitle == $title)]
       | sort_by(.createdAt) | last // empty | "\(.databaseId) \(.url)"' 2>/dev/null || true
}

# Dispatching does not tell us which run it created, so the run has to be found afterwards. The wait
# then follows that run and reports what it did, so the wrong run is worse than no run: the job would
# wait for somebody else's build and then blame its own tag.
#
# The title is what makes the choice exact. The pre-build workflow sets
#
#   run-name: ROR <ES|KBN> pre-build ${{ inputs.tag }}
#
# and the tag holds the run id and the attempt, so the title belongs to one dispatch only. Time alone
# cannot do this: two dispatches four seconds apart both fall in the window, and "the newest" then
# gives the second one to both jobs.
#
# A run with no title is nobody's run here. The workflow file on that ref has no run-name line, and
# this file cannot tell that run from any other; it fails instead. So the run-name line must be on
# every ref this dispatches to BEFORE this file reaches them.
#
# Echoes "<run id> <run url>".
# Usage: _locate_prebuild_run <repo> <workflow> <token> <created-since ISO8601> <expected title>
_locate_prebuild_run() {
  local REPO=$1 WORKFLOW=$2 TOKEN=$3 SINCE=$4 TITLE=$5 ATTEMPT RUN

  # The sleep comes first on purpose. GitHub takes a moment to register a dispatched run, so asking
  # immediately finds nothing.
  for ATTEMPT in 1 2 3 4 5 6 7 8 9 10 11 12; do
    sleep 5
    RUN=$(_prebuild_run_by_title "$REPO" "$WORKFLOW" "$TOKEN" "$SINCE" "$TITLE")
    if [ -n "$RUN" ]; then
      echo "$RUN"
      return 0
    fi
  done
  return 1
}

# Where _prebuild_run_state leaves its two answers: the state, and whatever a failed read said. The
# second one lets the wait name the real reason, the same way ROR_PREBUILD_LAST_PROBE_ERROR does for
# the registry.
ROR_PREBUILD_RUN_STATE=""
ROR_PREBUILD_LAST_RUN_READ_ERROR=""

# Reads what `gh` printed when it could not read a run, and says whether asking again can help.
# Echoes `unknown` (ask again) or `denied` (nothing here will change).
#
# A rate limit is tested first, because GitHub sends that as 403 as well, and a rate limit does pass.
# Anything unrecognised is `unknown`: only a message we know means "never" may end a wait.
# Usage: _prebuild_read_failure_state <what gh printed>
_prebuild_read_failure_state() {
  case "$1" in
    *"rate limit"* | *"secondary rate"* | *"abuse detection"*) echo unknown ;;
    *"HTTP 401"* | *"HTTP 403"* | *"HTTP 404"* | *"Bad credentials"* | *"Resource not accessible"* | \
      *"Could not resolve to a Repository"* | *"not found"* | *"Not Found"*) echo denied ;;
    *) echo unknown ;;
  esac
}

# The run's outcome, left in ROR_PREBUILD_RUN_STATE as one word: `running`, `success`, another
# conclusion (`failure`, `cancelled`, `timed_out`, ...), `unknown` when the read failed and asking
# again may help, or `denied` when it failed for a reason that no amount of waiting fixes.
#
# It writes to a variable rather than echoing, because the caller needs the failure text as well, and
# a command substitution would run this in a subshell, where the text would die with it.
#
# Telling `unknown` and `denied` apart is the whole point, and it is the same distinction
# _probe_dev_image makes for the registry. A token that cannot read the runs of the plugin repo
# answers the same way every 20 seconds, so treating that as "still running" spends the whole
# timeout to report a secret that was wrong before the job started.
#
# Never fails: the state is the answer.
# Usage: _prebuild_run_state <repo> <token> <run id>
_prebuild_run_state() {
  local REPO=$1 TOKEN=$2 RUN_ID=$3 JSON ERR_FILE STATUS=0

  # gh writes the reason to stderr, and the JSON to stdout, so the two are kept apart. Merging them
  # would put any notice of gh into the text that jq reads.
  ERR_FILE=$(mktemp)
  JSON=$(GH_TOKEN="$TOKEN" gh run view "$RUN_ID" -R "$REPO" --json status,conclusion 2>"$ERR_FILE") || STATUS=$?

  if [ "$STATUS" -ne 0 ]; then
    ROR_PREBUILD_LAST_RUN_READ_ERROR=$(cat "$ERR_FILE")
    rm -f "$ERR_FILE"
    ROR_PREBUILD_RUN_STATE=$(_prebuild_read_failure_state "$ROR_PREBUILD_LAST_RUN_READ_ERROR")
    return 0
  fi
  rm -f "$ERR_FILE"
  ROR_PREBUILD_LAST_RUN_READ_ERROR=""

  ROR_PREBUILD_RUN_STATE=$(echo "$JSON" |
    jq -r 'if .status != "completed" then "running" else (.conclusion // "unknown") end' 2>/dev/null) ||
    ROR_PREBUILD_RUN_STATE=unknown
  [ -n "$ROR_PREBUILD_RUN_STATE" ] || ROR_PREBUILD_RUN_STATE=unknown
}

# Set by _dispatch_prebuild_workflow so the plugin-specific wrappers below can stash the run they
# just started. A dispatch that returns 0 always sets them; a dispatch that cannot identify its run
# fails instead.
_ROR_LAST_DISPATCH_RUN_ID=""
_ROR_LAST_DISPATCH_RUN_URL=""

# Runs `gh workflow run` for one plugin. The plugins differ only in repo, workflow, token and input
# names, so the caller supplies the `-f key=value` pairs.
#
# The run tag names the title that the run carries, so the search after the dispatch can be exact.
# This is the only place that builds that title, and the run-name line in both pre-build workflows
# must produce the same text.
#
# Usage: _dispatch_prebuild_workflow <label> <repo> <workflow> <ref> <token> <run tag> <-f pairs...>
_dispatch_prebuild_workflow() {
  local LABEL=$1 REPO=$2 WORKFLOW=$3 REF=$4 TOKEN=$5 RUN_TAG=$6
  shift 6

  # Checked before the dispatch: without a tag there is no title, the run cannot be recognised, and a
  # build would start that nobody can follow.
  if [ -z "$RUN_TAG" ]; then
    echo "ERROR: the $LABEL pre-build needs a run tag. The tag names the images, and the run carries"
    echo "       it as its title, which is how the dispatch finds the run it created."
    return 1
  fi
  local TITLE="$LABEL pre-build $RUN_TAG"

  local REF_ARGS=()
  [ -n "$REF" ] && REF_ARGS=(--ref "$REF")

  # Taken before the dispatch, and backdated to absorb clock skew between this runner and GitHub —
  # a window that starts a moment too late would filter out our own run.
  local SINCE
  SINCE=$(_iso8601_minutes_ago 2)

  if ! GH_TOKEN="$TOKEN" gh workflow run "$WORKFLOW" -R "$REPO" "${REF_ARGS[@]}" "$@"; then
    echo "ERROR: Failed to dispatch the $LABEL pre-build workflow ($WORKFLOW in $REPO)"
    echo "       Both common failures point at the DEFAULT branch of $REPO, not at ref '${REF:-<default>}':"
    echo "       * 404 'workflow not found on the default branch' — GitHub only registers a"
    echo "         workflow_dispatch workflow once the file is on the default branch, and gh resolves"
    echo "         it by name against that set before applying --ref. Merge $WORKFLOW there first."
    echo "       * 422 'Unexpected inputs provided' — the input names above do not match the"
    echo "         default-branch copy of the workflow. Compare them against its workflow_dispatch"
    echo "         inputs (the listed keys are the ones it does not recognise) and update the caller."
    return 3
  fi
  echo ">>> Dispatch sent"

  _ROR_LAST_DISPATCH_RUN_ID=""
  _ROR_LAST_DISPATCH_RUN_URL=""

  local RUN
  if ! RUN=$(_locate_prebuild_run "$REPO" "$WORKFLOW" "$TOKEN" "$SINCE" "$TITLE"); then
    echo "ERROR: the $LABEL pre-build started, but its run could not be found in $REPO."
    echo "       The wait follows that run, so there is nothing to wait for. The job stops here. It"
    echo "       does not poll the registry instead: that spends the Docker Hub pull budget and still"
    echo "       cannot show a failed build."
    echo "       The run itself continues, and this failure does not affect it. Re-run this job."
    echo "       The run is found by its title, '$TITLE'. Three causes are likely:"
    echo "       * '$WORKFLOW' on ref '${REF:-<default>}' has no 'run-name:' line, so its runs carry"
    echo "         the workflow name and none of them can be told from another. Add to that file:"
    echo "             run-name: $LABEL pre-build \${{ inputs.tag }}"
    echo "       * the token cannot list the runs of $REPO ('gh run list' needs actions:read)."
    echo "       * '$WORKFLOW' runs so often that ours is not in the 20 most recent."
    return 4
  fi

  _ROR_LAST_DISPATCH_RUN_ID=${RUN%% *}
  _ROR_LAST_DISPATCH_RUN_URL=${RUN#* }
  echo ">>> $LABEL run: $_ROR_LAST_DISPATCH_RUN_URL"
}

# Applies the "auto" setting: use the preferred ref if it exists in the repo, otherwise the fallback.
# Any other setting is returned unchanged, including empty. Never fails — if the lookup does not
# work, the fallback is used rather than blocking the dispatch.
# Usage: _resolve_workflow_ref <setting> <repo> <token> <preferred ref> <fallback ref>
_resolve_workflow_ref() {
  local SETTING=$1 REPO=$2 TOKEN=$3 PREFERRED=$4 FALLBACK=$5

  if [ "$SETTING" != "auto" ]; then
    echo "$SETTING"
    return 0
  fi

  if [ -n "$PREFERRED" ] && GH_TOKEN="$TOKEN" gh api "repos/$REPO/branches/$PREFERRED" >/dev/null 2>&1; then
    echo "$PREFERRED"
  else
    echo "$FALLBACK"
  fi
}

# Checks that a dispatch token is usable. Empty means the secret is not configured; a value starting
# with `$(` means a CI variable was never expanded and arrived as literal text, which would otherwise
# fail later as an unexplained 401.
# Usage: _require_dispatch_token <env var name> <label>
_require_dispatch_token() {
  local NAME=$1 LABEL=$2 VALUE=${!1:-}
  if [ -z "$VALUE" ] || [[ "$VALUE" == '$('* ]]; then
    echo "ERROR: $NAME is not set or was not resolved (required to dispatch the $LABEL pre-build workflow)"
    return 2
  fi
}

# Usage: dispatch_kbn_prebuild_image <kbn versions> <target branch> <run tag> [force rebuild]
dispatch_kbn_prebuild_image() {
  if [ "$#" -lt 3 ]; then
    echo "Usage: dispatch_kbn_prebuild_image <kbn versions> <target branch> <run tag> [force rebuild]"
    return 1
  fi

  local KBN_VERSIONS TARGET_BRANCH RUN_TAG FORCE_REBUILD
  KBN_VERSIONS=$(normalize_elk_versions "$1") || return $?
  TARGET_BRANCH=$2
  RUN_TAG=$3
  FORCE_REBUILD=${4:-false}

  _require_dispatch_token KBN_REPO_GH_TOKEN "ROR KBN" || return $?

  local WORKFLOW_REF
  WORKFLOW_REF=$(_resolve_workflow_ref "$ROR_KBN_PUBLISH_WORKFLOW_REF" "$ROR_KBN_GH_REPO" \
    "$KBN_REPO_GH_TOKEN" "$TARGET_BRANCH" "$ROR_KBN_PUBLISH_WORKFLOW_FALLBACK_REF")

  echo ""
  echo ">>> Dispatching ROR KBN pre-build: versions=$KBN_VERSIONS tag=$RUN_TAG branch=$TARGET_BRANCH${WORKFLOW_REF:+ (workflow ref: $WORKFLOW_REF)}"

  # Same naming rule as ES below: these must match the workflow's inputs on its default branch.
  _dispatch_prebuild_workflow "ROR KBN" \
    "$ROR_KBN_GH_REPO" "$ROR_KBN_PUBLISH_WORKFLOW" "$WORKFLOW_REF" "$KBN_REPO_GH_TOKEN" "$RUN_TAG" \
    -f "kbn_versions=$KBN_VERSIONS" \
    -f "target_branch=$TARGET_BRANCH" \
    -f "tag=$RUN_TAG" \
    -f "force_rebuild=$FORCE_REBUILD" || return $?

  # Read by wait_for_plugin_prebuild_images: the run it names is the one the wait follows, so a build
  # that fails in two minutes does not cost the wait its whole timeout.
  ROR_KBN_PREBUILD_RUN_ID=$_ROR_LAST_DISPATCH_RUN_ID
  ROR_KBN_PREBUILD_RUN_URL=$_ROR_LAST_DISPATCH_RUN_URL
}

# Usage: dispatch_es_prebuild_image <es versions> <target branch> <run tag> [force rebuild]
dispatch_es_prebuild_image() {
  if [ "$#" -lt 3 ]; then
    echo "Usage: dispatch_es_prebuild_image <es versions> <target branch> <run tag> [force rebuild]"
    return 1
  fi

  local ES_VERSIONS TARGET_BRANCH RUN_TAG FORCE_REBUILD
  ES_VERSIONS=$(normalize_elk_versions "$1") || return $?
  TARGET_BRANCH=$2
  RUN_TAG=$3
  FORCE_REBUILD=${4:-false}

  _require_dispatch_token ES_REPO_GH_TOKEN "ROR ES" || return $?

  local WORKFLOW_REF
  WORKFLOW_REF=$(_resolve_workflow_ref "$ROR_ES_PUBLISH_WORKFLOW_REF" "$ROR_ES_GH_REPO" \
    "$ES_REPO_GH_TOKEN" "$TARGET_BRANCH" "$ROR_ES_PUBLISH_WORKFLOW_FALLBACK_REF")

  echo ""
  echo ">>> Dispatching ROR ES pre-build: versions=$ES_VERSIONS tag=$RUN_TAG branch=$TARGET_BRANCH${WORKFLOW_REF:+ (workflow ref: $WORKFLOW_REF)}"

  # These names must match the workflow's inputs on the repo's default branch. GitHub validates a
  # dispatch against that copy, not against the one on WORKFLOW_REF. A mismatch fails with 422
  # "Unexpected inputs provided", listing the names it did not recognise.
  _dispatch_prebuild_workflow "ROR ES" \
    "$ROR_ES_GH_REPO" "$ROR_ES_PUBLISH_WORKFLOW" "$WORKFLOW_REF" "$ES_REPO_GH_TOKEN" "$RUN_TAG" \
    -f "es_versions=$ES_VERSIONS" \
    -f "target_branch=$TARGET_BRANCH" \
    -f "tag=$RUN_TAG" \
    -f "force_rebuild=$FORCE_REBUILD" || return $?

  # Read by wait_for_plugin_prebuild_images: the run it names is the one the wait follows, so a build
  # that fails in two minutes does not cost the wait its whole timeout.
  ROR_ES_PREBUILD_RUN_ID=$_ROR_LAST_DISPATCH_RUN_ID
  ROR_ES_PREBUILD_RUN_URL=$_ROR_LAST_DISPATCH_RUN_URL
}

# Dispatches both plugins with the same arguments.
# Usage: dispatch_prebuild_images <versions> <target branch> <run tag> [force rebuild]
dispatch_prebuild_images() {
  if [ "$#" -lt 3 ]; then
    echo "Usage: dispatch_prebuild_images <versions> <target branch> <run tag> [force rebuild]"
    return 1
  fi

  dispatch_es_prebuild_image "$@" || return $?
  dispatch_kbn_prebuild_image "$@" || return $?
}

# --- Wait --------------------------------------------------------------------------------------
#
# The wait has two steps:
#   1. Follow the pre-build run until it finishes. GitHub answers these requests, and Docker Hub
#      does not count them.
#   2. Ask the registry for each tag that the run published. One dispatch covers every version, and
#      the run pushes all of them before it reports success, so one attempt for each image is
#      normally enough.
#
# The wait therefore asks the registry once for each image, and not once a minute for the whole
# build. For four versions of two plugins that is about 8 pulls in place of about 90.

# Follows one pre-build run until it finishes. Returns:
#   0 - the run succeeded
#   4 - the run did not finish within the timeout
#   6 - the run finished without succeeding
#   8 - the run cannot be read, and asking again will not change that
#
# A state that cannot be read counts as "still running", because a single failed API call must not
# end a healthy wait. A state that is refused does not: see the `denied` branch below.
#
# Usage: _wait_for_prebuild_run <label> <repo> <token> <run id> <run url> <timeout seconds>
_wait_for_prebuild_run() {
  local LABEL=$1 REPO=$2 TOKEN=$3 RUN_ID=$4 RUN_URL=$5 TIMEOUT=$6
  local WAITED=0 UNREADABLE=0 DENIED=0 STATE

  echo ""
  echo ">>> Waiting for the $LABEL pre-build run to finish (timeout: $((TIMEOUT / 60)) min)${RUN_URL:+: $RUN_URL}"

  while true; do
    # Not `STATE=$(...)`: the state comes back in a variable, so that the text of a failed read
    # survives with it.
    _prebuild_run_state "$REPO" "$TOKEN" "$RUN_ID"
    STATE=$ROR_PREBUILD_RUN_STATE
    case "$STATE" in
      success)
        echo ">>> The $LABEL pre-build run succeeded after $((WAITED / 60)) min."
        return 0
        ;;
      running) DENIED=0 ;;
      unknown)
        UNREADABLE=$((UNREADABLE + 1))
        # Once is enough; repeating it every 20 seconds would bury the rest of the log.
        if [ "$UNREADABLE" -eq 1 ]; then
          echo "WARNING: the state of the $LABEL run could not be read. The wait continues, because"
          echo "         this answer can change. A rate limit reads this way, and so does a network"
          echo "         error."
        fi
        ;;
      denied)
        DENIED=$((DENIED + 1))
        # The second refusal in a row ends the wait. The first one does not: GitHub answers 404 for a
        # run it has not finished registering, and one bad answer during an incident must not fail a
        # build that is running well.
        if [ "$DENIED" -lt 2 ]; then
          echo "WARNING: reading the state of the $LABEL run was refused. Asking once more."
        else
          echo "ERROR: the $LABEL pre-build run cannot be read, and asking again will not change that."
          echo "       The last answer from gh was:"
          echo "       $ROR_PREBUILD_LAST_RUN_READ_ERROR"
          echo "       The token for $REPO must be able to read the runs of that repo ('actions:read'),"
          echo "       and run $RUN_ID must exist there. The wait stops here rather than spend the whole"
          echo "       $((TIMEOUT / 60)) min to say the same thing: without the run there is nothing to"
          echo "       follow, and the registry cannot show a failed build."
          echo "       Run: ${RUN_URL:-<unknown>}"
          return 8
        fi
        ;;
      *)
        echo "ERROR: the $LABEL pre-build run finished with '$STATE', so its images will never be published."
        echo "       Run: ${RUN_URL:-<unknown>}"
        return 6
        ;;
    esac

    if [ "$WAITED" -ge "$TIMEOUT" ]; then
      echo "ERROR: the $LABEL pre-build run did not finish within $((WAITED / 60)) min."
      if [ "$UNREADABLE" -gt 0 ]; then
        echo "       $UNREADABLE state requests failed, so the run may have finished. GitHub did not"
        echo "       refuse them, so look for a rate limit on the token, or for a network fault."
        echo "       The last one said: $ROR_PREBUILD_LAST_RUN_READ_ERROR"
      fi
      echo "       Run: ${RUN_URL:-<unknown>}"
      return 4
    fi

    sleep "$ROR_PREBUILD_RUN_POLL_INTERVAL_SECONDS"
    WAITED=$((WAITED + ROR_PREBUILD_RUN_POLL_INTERVAL_SECONDS))
  done
}

# Asks the registry for one tag, up to ATTEMPTS times, INTERVAL seconds apart. Every attempt costs
# one pull from the Docker Hub rate limit. Returns:
#   0 - the tag is there
#   1 - the registry answered, and the tag is not there
#   2 - the registry could not be queried
#
# Usage: _verify_dev_image <image> <attempts> <interval seconds>
_verify_dev_image() {
  local IMAGE=$1 ATTEMPTS=$2 INTERVAL=$3 ATTEMPT=1 STATUS

  while true; do
    STATUS=0
    _probe_dev_image "$IMAGE" || STATUS=$?

    if [ "$STATUS" -eq 0 ]; then
      echo ">>> Found $IMAGE"
      return 0
    fi

    if [ "$ATTEMPT" -ge "$ATTEMPTS" ]; then
      return "$STATUS"
    fi

    if [ "$STATUS" -eq 2 ]; then
      echo ">>> The registry could not be queried for $IMAGE (attempt $ATTEMPT of $ATTEMPTS). It said:"
      echo "    $ROR_PREBUILD_LAST_PROBE_ERROR"
    else
      echo ">>> $IMAGE is not there yet (attempt $ATTEMPT of $ATTEMPTS)."
    fi

    sleep "$INTERVAL"
    ATTEMPT=$((ATTEMPT + 1))
  done
}

# Waits for one plugin: first for its run, then for the images of every version.
#
# The run must be known, so the dispatch must happen in the same shell. There is no registry-only
# mode: the registry alone cannot show a failed build, and it spends Docker Hub pulls to learn what
# one GitHub request gives for free.
#
# Returns 0, or one of:
#   1 - wrong arguments          5 - the run succeeded, and an image is not in the registry
#   2 - unknown plugin           6 - the run failed
#   3 - no run to follow         7 - the registry could not be queried
#   4 - the run did not finish   8 - the run could not be read: the token or the run id is wrong
#       in time
#
# Usage: wait_for_plugin_prebuild_images <es|kbn> <versions> <run tag>
wait_for_plugin_prebuild_images() {
  if [ "$#" -ne 3 ]; then
    echo "Usage: wait_for_plugin_prebuild_images <es|kbn> <versions> <run tag>"
    return 1
  fi

  local PLUGIN=$1 RUN_TAG=$3 VERSIONS
  VERSIONS=$(normalize_elk_versions "$2") || return $?

  local LABEL WHERE TIMEOUT RUN_ID RUN_URL RUN_REPO RUN_TOKEN
  case "$PLUGIN" in
    es)
      LABEL="ROR ES"
      WHERE="the '$ROR_ES_PUBLISH_WORKFLOW' run in $ROR_ES_GH_REPO"
      TIMEOUT=$ROR_ES_WAIT_TIMEOUT_SECONDS
      RUN_ID=${ROR_ES_PREBUILD_RUN_ID:-}
      RUN_URL=${ROR_ES_PREBUILD_RUN_URL:-}
      RUN_REPO=$ROR_ES_GH_REPO
      RUN_TOKEN=${ES_REPO_GH_TOKEN:-}
      ;;
    kbn)
      LABEL="ROR KBN"
      WHERE="the '$ROR_KBN_PUBLISH_WORKFLOW' run in $ROR_KBN_GH_REPO"
      TIMEOUT=$ROR_KBN_WAIT_TIMEOUT_SECONDS
      RUN_ID=${ROR_KBN_PREBUILD_RUN_ID:-}
      RUN_URL=${ROR_KBN_PREBUILD_RUN_URL:-}
      RUN_REPO=$ROR_KBN_GH_REPO
      RUN_TOKEN=${KBN_REPO_GH_TOKEN:-}
      ;;
    *)
      echo "ERROR: wait_for_plugin_prebuild_images: plugin must be 'es' or 'kbn', got '$PLUGIN'"
      return 2
      ;;
  esac

  if [ -z "$RUN_ID" ]; then
    echo "ERROR: there is no $LABEL pre-build run to follow. Dispatch the pre-build from this same"
    echo "       shell, or name an existing run in the ROR_*_PREBUILD_RUN_ID variables above."
    return 3
  fi

  _wait_for_prebuild_run "$LABEL" "$RUN_REPO" "$RUN_TOKEN" "$RUN_ID" "$RUN_URL" "$TIMEOUT" || return $?

  local ATTEMPTS=$ROR_PREBUILD_IMAGE_CHECK_ATTEMPTS
  local INTERVAL=$ROR_PREBUILD_IMAGE_CHECK_INTERVAL_SECONDS

  echo ""
  echo ">>> Checking the registry for the $LABEL images of: $VERSIONS"

  local VERSION IMAGE STATUS
  for VERSION in $VERSIONS; do
    case "$PLUGIN" in
      es) IMAGE=$(ror_es_dev_image "$VERSION" "$RUN_TAG") ;;
      kbn) IMAGE=$(ror_kbn_dev_image "$VERSION" "$RUN_TAG") ;;
    esac

    STATUS=0
    _verify_dev_image "$IMAGE" "$ATTEMPTS" "$INTERVAL" || STATUS=$?
    [ "$STATUS" -eq 0 ] && continue

    if [ "$STATUS" -eq 2 ]; then
      echo "ERROR: the registry could not be queried for $IMAGE, so nobody knows if it is there."
      echo "       The last answer from docker was:"
      echo "       $ROR_PREBUILD_LAST_PROBE_ERROR"
      echo "       A rate limit and a broken login both look like a missing image. The wait stops"
      echo "       here, rather than continue on an answer it cannot trust."
      return 7
    fi

    echo "ERROR: $WHERE succeeded, but $IMAGE is not in the registry."
    echo "       Open the run below and compare the tags it wrote against '$RUN_TAG', and the repo it"
    echo "       pushed to against the ROR_*_DEV_IMAGE_REPO defaults in this file."
    echo "       Check first that the run is the one this job dispatched. The title of a run names its"
    echo "       tag, so a title that does not hold '$RUN_TAG' means the job followed another run, and"
    echo "       the workflow file on that branch has no 'run-name:' line."
    echo "       Run: ${RUN_URL:-<unknown>}"
    return 5
  done
}

# Wrappers for waiting on a single plugin.
# Usage: wait_for_<es|kbn>_prebuild_images <versions> <run tag>
wait_for_es_prebuild_images() { wait_for_plugin_prebuild_images es "$1" "$2"; }
wait_for_kbn_prebuild_images() { wait_for_plugin_prebuild_images kbn "$1" "$2"; }

# Transitional aliases for the singular names this file had before the wait was rewritten. The ROR ES
# and ROR KBN repos clone this file when they run, and they fall back to `develop`, so a branch of
# theirs that predates the rewrite breaks as soon as this lands. One version is a valid list of one,
# so both forms behave the same. Delete these two lines after both repos call the new names
# (RORDEV-2183).
wait_for_es_prebuild_image() { wait_for_plugin_prebuild_images es "$1" "$2"; }
wait_for_kbn_prebuild_image() { wait_for_plugin_prebuild_images kbn "$1" "$2"; }

# Waits for both plugins, for every version. ES comes first because its build is the slower one. The
# Kibana run has usually finished by then.
# Usage: wait_for_prebuild_images <versions> <run tag>
wait_for_prebuild_images() {
  if [ "$#" -ne 2 ]; then
    echo "Usage: wait_for_prebuild_images <versions> <run tag>"
    return 1
  fi

  wait_for_plugin_prebuild_images es "$1" "$2" || return $?
  wait_for_plugin_prebuild_images kbn "$1" "$2" || return $?
}
