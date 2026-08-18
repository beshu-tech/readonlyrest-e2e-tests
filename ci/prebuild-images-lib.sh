# Helpers for producing ROR plugin dev images: trigger the pre-build workflow in a plugin repo, then
# wait for the image it publishes to appear in the registry.
#
# Sourced, not executed.
#
# Needs `gh` and `jq` to dispatch and to follow the run, and `docker` to probe the registry, each
# only when the matching function is called.
#
# Nothing relies on the caller using `set -e`: every function returns non-zero on failure, and the
# ones that call others pass that status on with `|| return $?`.

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

# How long to wait for a published image before giving up. ES gets the longer limit because its
# build takes longer than the Kibana one.
ROR_ES_WAIT_TIMEOUT_SECONDS="${ROR_ES_WAIT_TIMEOUT_SECONDS:-$((45 * 60))}"
ROR_KBN_WAIT_TIMEOUT_SECONDS="${ROR_KBN_WAIT_TIMEOUT_SECONDS:-$((30 * 60))}"

# Every poll costs one registry manifest request, and Docker Hub counts those against the pull rate
# limit. The job authenticates first, with ci/docker-hub-auth.sh, so the limit that applies is the
# one of the ROR account (200 per 6h) and not the one of the runner address (100 per 6h), which all
# GitHub customers share. Eight images at this interval stay well inside the account limit.
ROR_PREBUILD_POLL_INTERVAL_SECONDS="${ROR_PREBUILD_POLL_INTERVAL_SECONDS:-60}"

# Grace period after the plugin run reports success, before concluding that the run finished without
# publishing the tag we asked for. Covers the gap between the push and the tag being readable.
ROR_PREBUILD_POST_SUCCESS_GRACE_SECONDS="${ROR_PREBUILD_POST_SUCCESS_GRACE_SECONDS:-120}"

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
# `docker manifest inspect >/dev/null 2>&1`, so a throttled or unauthorised probe silently spins for
# the entire timeout and then blames the plugin workflow for something that happened here.
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

# Dispatching does not tell us which run it created, so the run has to be found afterwards: the
# newest one of that workflow created since we asked. Echoes "<run id> <run url>".
#
# Best-effort — a failure here only costs the fast-fail in the wait loop, so it is never fatal. The
# `--limit 20` window and the timestamp filter can both miss under heavy concurrency in the plugin
# repo; that is the same trade-off.
# Usage: _locate_prebuild_run <repo> <workflow> <token> <created-since ISO8601>
_locate_prebuild_run() {
  local REPO=$1 WORKFLOW=$2 TOKEN=$3 SINCE=$4 ATTEMPT RUN

  # Comparing the timestamps as strings is exact: gh and `date` above both emit
  # YYYY-MM-DDTHH:MM:SSZ, which sorts lexicographically.
  #
  # The sleep comes first on purpose. GitHub takes a moment to register a dispatched run, and the
  # window is backdated, so asking immediately can return somebody else's slightly older run of the
  # same workflow and latch onto it. Waiting first makes our run — the newest — the one `last` picks.
  for ATTEMPT in 1 2 3 4 5 6; do
    sleep 5
    RUN=$(GH_TOKEN="$TOKEN" gh run list -R "$REPO" --workflow "$WORKFLOW" --limit 20 \
      --json databaseId,url,createdAt 2>/dev/null |
      jq -r --arg since "$SINCE" \
        '[.[] | select(.createdAt >= $since)] | sort_by(.createdAt) | last // empty
         | "\(.databaseId) \(.url)"' 2>/dev/null) || RUN=""
    if [ -n "$RUN" ]; then
      echo "$RUN"
      return 0
    fi
  done
  return 1
}

# The run's outcome as one word: `running`, `success`, another conclusion (`failure`, `cancelled`,
# `timed_out`, ...), or `unknown` when it cannot be read. Never fails, so a flaky API call degrades
# to "keep waiting" rather than aborting a healthy wait.
# Usage: _prebuild_run_state <repo> <token> <run id>
_prebuild_run_state() {
  local REPO=$1 TOKEN=$2 RUN_ID=$3 JSON STATE

  JSON=$(GH_TOKEN="$TOKEN" gh run view "$RUN_ID" -R "$REPO" --json status,conclusion 2>/dev/null) || {
    echo unknown
    return 0
  }
  STATE=$(echo "$JSON" | jq -r 'if .status != "completed" then "running" else (.conclusion // "unknown") end' 2>/dev/null) ||
    STATE=unknown
  echo "${STATE:-unknown}"
}

# Set by _dispatch_prebuild_workflow so the plugin-specific wrappers below can stash the run they
# just started. Empty when the run could not be identified.
_ROR_LAST_DISPATCH_RUN_ID=""
_ROR_LAST_DISPATCH_RUN_URL=""

# Runs `gh workflow run` for one plugin. The plugins differ only in repo, workflow, token and input
# names, so the caller supplies the `-f key=value` pairs.
#
# Usage: _dispatch_prebuild_workflow <label> <repo> <workflow> <ref> <token> <-f pairs...>
_dispatch_prebuild_workflow() {
  local LABEL=$1 REPO=$2 WORKFLOW=$3 REF=$4 TOKEN=$5
  shift 5

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
  if RUN=$(_locate_prebuild_run "$REPO" "$WORKFLOW" "$TOKEN" "$SINCE"); then
    _ROR_LAST_DISPATCH_RUN_ID=${RUN%% *}
    _ROR_LAST_DISPATCH_RUN_URL=${RUN#* }
    echo ">>> $LABEL run: $_ROR_LAST_DISPATCH_RUN_URL"
  else
    echo ">>> Could not identify the $LABEL run that was just started."
    echo "    The wait below still works; it just cannot stop early if that run fails."
  fi
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
    "$ROR_KBN_GH_REPO" "$ROR_KBN_PUBLISH_WORKFLOW" "$WORKFLOW_REF" "$KBN_REPO_GH_TOKEN" \
    -f "kbn_versions=$KBN_VERSIONS" \
    -f "target_branch=$TARGET_BRANCH" \
    -f "tag=$RUN_TAG" \
    -f "force_rebuild=$FORCE_REBUILD" || return $?

  # Read by wait_for_prebuild_image, so a build that fails in two minutes does not cost the wait its
  # whole timeout.
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
    "$ROR_ES_GH_REPO" "$ROR_ES_PUBLISH_WORKFLOW" "$WORKFLOW_REF" "$ES_REPO_GH_TOKEN" \
    -f "es_versions=$ES_VERSIONS" \
    -f "target_branch=$TARGET_BRANCH" \
    -f "tag=$RUN_TAG" \
    -f "force_rebuild=$FORCE_REBUILD" || return $?

  # Read by wait_for_prebuild_image, so a build that fails in two minutes does not cost the wait its
  # whole timeout.
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

# Polls the registry until the image for one plugin, version and tag exists. Returns quickly when
# the workflow only had to re-tag an existing image.
#
# Three ways this ends other than success, each reported as itself rather than as a bare timeout:
#   * the plugin run finished without succeeding      -> stop now, print its URL
#   * the run succeeded but the tag never appeared    -> the tag we asked for is not the tag it
#                                                        published; stop after a short grace period
#   * the registry could not be queried at all        -> print what the probe actually said
#
# Usage: wait_for_prebuild_image <es|kbn> <version> <run tag> [timeout seconds]
wait_for_prebuild_image() {
  if [ "$#" -lt 3 ]; then
    echo "Usage: wait_for_prebuild_image <es|kbn> <version> <run tag> [timeout seconds]"
    return 1
  fi

  local PLUGIN=$1 VERSION=$2 RUN_TAG=$3 TIMEOUT=${4:-} IMAGE WHERE RUN_ID RUN_URL RUN_REPO RUN_TOKEN
  case "$PLUGIN" in
    es)
      IMAGE=$(ror_es_dev_image "$VERSION" "$RUN_TAG")
      TIMEOUT=${TIMEOUT:-$ROR_ES_WAIT_TIMEOUT_SECONDS}
      WHERE="the '$ROR_ES_PUBLISH_WORKFLOW' run in $ROR_ES_GH_REPO"
      RUN_ID=${ROR_ES_PREBUILD_RUN_ID:-}
      RUN_URL=${ROR_ES_PREBUILD_RUN_URL:-}
      RUN_REPO=$ROR_ES_GH_REPO
      RUN_TOKEN=${ES_REPO_GH_TOKEN:-}
      ;;
    kbn)
      IMAGE=$(ror_kbn_dev_image "$VERSION" "$RUN_TAG")
      TIMEOUT=${TIMEOUT:-$ROR_KBN_WAIT_TIMEOUT_SECONDS}
      WHERE="the '$ROR_KBN_PUBLISH_WORKFLOW' run in $ROR_KBN_GH_REPO"
      RUN_ID=${ROR_KBN_PREBUILD_RUN_ID:-}
      RUN_URL=${ROR_KBN_PREBUILD_RUN_URL:-}
      RUN_REPO=$ROR_KBN_GH_REPO
      RUN_TOKEN=${KBN_REPO_GH_TOKEN:-}
      ;;
    *)
      echo "ERROR: wait_for_prebuild_image: plugin must be 'es' or 'kbn', got '$PLUGIN'"
      return 2
      ;;
  esac

  local WAITED=0 PROBE_STATUS PROBE_ERRORS=0 SUCCEEDED_AT="" RUN_STATE
  echo ""
  echo ">>> Polling for $IMAGE (timeout: $((TIMEOUT / 60)) min)${RUN_URL:+, run: $RUN_URL}"

  while true; do
    PROBE_STATUS=0
    _probe_dev_image "$IMAGE" || PROBE_STATUS=$?

    if [ "$PROBE_STATUS" -eq 0 ]; then
      echo ">>> Dev image is now available: $IMAGE"
      return 0
    fi

    if [ "$PROBE_STATUS" -eq 2 ]; then
      PROBE_ERRORS=$((PROBE_ERRORS + 1))
      # Once per image is enough; repeating it every minute would bury the rest of the log.
      if [ "$PROBE_ERRORS" -eq 1 ]; then
        echo "WARNING: the registry could not be queried for $IMAGE. Still polling, but if this is a"
        echo "         rate limit the wait cannot succeed. Docker reported:"
        echo "         $ROR_PREBUILD_LAST_PROBE_ERROR"
      fi
    fi

    if [ -n "$RUN_ID" ]; then
      RUN_STATE=$(_prebuild_run_state "$RUN_REPO" "$RUN_TOKEN" "$RUN_ID")
      case "$RUN_STATE" in
        success)
          # The run is done, so either the image is being pushed right now or it never will be.
          if [ -z "$SUCCEEDED_AT" ]; then
            SUCCEEDED_AT=$WAITED
          elif [ "$((WAITED - SUCCEEDED_AT))" -ge "$ROR_PREBUILD_POST_SUCCESS_GRACE_SECONDS" ]; then
            echo "ERROR: $WHERE succeeded, but $IMAGE is still not in the registry ${ROR_PREBUILD_POST_SUCCESS_GRACE_SECONDS}s later."
            echo "       The run published a different tag than the one being waited for — compare"
            echo "       the tag it wrote against '$RUN_TAG' and the repo against the ROR_*_DEV_IMAGE_REPO"
            echo "       defaults in this file."
            echo "       Run: ${RUN_URL:-<unknown>}"
            return 5
          fi
          ;;
        running | unknown) ;;
        *)
          echo "ERROR: $WHERE finished with '$RUN_STATE'; $IMAGE will never be published."
          echo "       Run: ${RUN_URL:-<unknown>}"
          return 6
          ;;
      esac
    fi

    if [ "$WAITED" -ge "$TIMEOUT" ]; then
      echo "ERROR: Timed out after $((WAITED / 60)) min waiting for $IMAGE"
      if [ "$PROBE_ERRORS" -gt 0 ]; then
        echo "       $PROBE_ERRORS of the registry probes failed outright, the last one with:"
        echo "       $ROR_PREBUILD_LAST_PROBE_ERROR"
        echo "       That, not the plugin build, may be what this timeout is really about."
      else
        echo "       Check $WHERE.${RUN_URL:+ Run: $RUN_URL}"
      fi
      return 4
    fi

    sleep "$ROR_PREBUILD_POLL_INTERVAL_SECONDS"
    WAITED=$((WAITED + ROR_PREBUILD_POLL_INTERVAL_SECONDS))
  done
}

# Wrappers for waiting on a single plugin.
# Usage: wait_for_<es|kbn>_prebuild_image <version> <run tag>
wait_for_es_prebuild_image() { wait_for_prebuild_image es "$1" "$2"; }
wait_for_kbn_prebuild_image() { wait_for_prebuild_image kbn "$1" "$2"; }

# Waits for both plugins, for every version. ES is waited on first because it is the slower build,
# by which time the Kibana images are usually already there.
# Usage: wait_for_prebuild_images <versions> <run tag>
wait_for_prebuild_images() {
  if [ "$#" -ne 2 ]; then
    echo "Usage: wait_for_prebuild_images <versions> <run tag>"
    return 1
  fi

  local VERSIONS RUN_TAG=$2 VERSION
  VERSIONS=$(normalize_elk_versions "$1") || return $?

  for VERSION in $VERSIONS; do
    wait_for_prebuild_image es "$VERSION" "$RUN_TAG" || return $?
  done
  for VERSION in $VERSIONS; do
    wait_for_prebuild_image kbn "$VERSION" "$RUN_TAG" || return $?
  done
}
