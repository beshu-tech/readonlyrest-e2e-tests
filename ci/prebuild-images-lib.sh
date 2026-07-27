# Shared helpers for dispatching and awaiting ROR plugin pre-build Docker images.
#
# Sourced — do not execute directly.
#
# This file is the single home of the cross-repo pre-build contract. Three repos consume it:
#
#   readonlyrest-e2e-tests  (this repo)  dispatches BOTH plugins, waits for both, runs ./runner.sh
#   elasticsearch-readonly… (ROR ES)     dispatches KBN, builds ES itself, waits for KBN
#   readonlyrest_kbn        (ROR KBN)    dispatches ES,  builds KBN itself, waits for ES
#
# The plugin repos already clone this repo to run the Cypress suite, so they can source this file
# from that clone:
#
#   . "$E2E_DIR/ci/prebuild-images-lib.sh"
#
# — provided the clone is hoisted to the start of their flow (today they clone at step 4, after the
# dispatch at step 1). Function names and argument orders below deliberately match the copies that
# currently live in those repos, so adopting this file is a delete-and-source with no call-site
# changes.
#
# What deliberately stays in the consuming repos: building their own plugin image
# (publish_ror_prebuild_plugin / publish_kbn_prebuild_image), cloning this repo, invoking
# ./runner.sh, and uploading Cypress artifacts. Those are repo-specific; only the dispatch/poll
# layer is genuinely shared, and it is where the subtle details live (JSON escaping of
# attacker-controlled branch names, poll timeouts, skip-optimization semantics).
#
# Required tooling is needed only at call time, not at source time: `gh` for either dispatch,
# `docker` for the polls. A consumer that never calls a given function never needs its tools.
#
# Nothing here relies on the caller running under `set -e`: every step returns a non-zero status and
# composite helpers propagate it explicitly with `|| return $?`.

# Guard against double-sourcing (a consumer may source this from more than one script).
if [ -n "${_ROR_PREBUILD_IMAGES_LIB_SOURCED:-}" ]; then
  return 0 2>/dev/null || true
fi
_ROR_PREBUILD_IMAGES_LIB_SOURCED=1

# --- Coordinates -------------------------------------------------------------------------------
# Overridable via the environment so a fork or a dry run can point elsewhere; the defaults are the
# real ones and are what every consumer uses.

# Both plugins publish pre-builds from a manually-dispatchable GitHub Actions workflow, driven here
# with the `gh` CLI. The ES side used to be an Azure DevOps pipeline hit over the REST API; it was
# ported to Actions and .azure/ was deleted, so the Azure coordinates are gone with it.
ROR_KBN_GH_REPO="${ROR_KBN_GH_REPO:-sscarduzio/readonlyrest_kbn}"
ROR_KBN_PUBLISH_WORKFLOW="${ROR_KBN_PUBLISH_WORKFLOW:-publish-pre-builds.yml}"

ROR_ES_GH_REPO="${ROR_ES_GH_REPO:-sscarduzio/elasticsearch-readonlyrest-plugin}"
ROR_ES_PUBLISH_WORKFLOW="${ROR_ES_PUBLISH_WORKFLOW:-publish-pre-builds.yml}"

# Which ref the workflow YAML is READ from. This is not the same thing as which sources get built —
# that is the separate target-branch input. Reading from the target branch matters when the workflow
# itself is being changed on that branch: otherwise you dispatch develop's copy and silently test
# the wrong pipeline.
#
# "auto" (the default) prefers the target branch when it exists in the plugin repo and falls back to
# ...FALLBACK_REF otherwise, mirroring how both workflows treat their own target-branch input. Set to
# a literal ref to pin, or to empty to let gh use the repo's default branch.
#
# HARD CONSTRAINT this cannot work around: GitHub only makes a workflow_dispatch workflow
# dispatchable once the file is present on the repo's DEFAULT branch — `gh workflow run` resolves the
# workflow by name against that registered set before it ever looks at --ref. A workflow living only
# on a feature branch 404s no matter what ref is chosen here. The two repos' defaults differ (ROR KBN
# is develop, ROR ES is master), so a file merged only to develop is dispatchable in one and not the
# other.
ROR_ES_PUBLISH_WORKFLOW_REF="${ROR_ES_PUBLISH_WORKFLOW_REF-auto}"
ROR_KBN_PUBLISH_WORKFLOW_REF="${ROR_KBN_PUBLISH_WORKFLOW_REF-auto}"
ROR_ES_PUBLISH_WORKFLOW_FALLBACK_REF="${ROR_ES_PUBLISH_WORKFLOW_FALLBACK_REF:-develop}"
ROR_KBN_PUBLISH_WORKFLOW_FALLBACK_REF="${ROR_KBN_PUBLISH_WORKFLOW_FALLBACK_REF:-develop}"

ROR_ES_DEV_IMAGE_REPO="${ROR_ES_DEV_IMAGE_REPO:-beshultd/elasticsearch-readonlyrest-dev}"
ROR_KBN_DEV_IMAGE_REPO="${ROR_KBN_DEV_IMAGE_REPO:-beshultd/kibana-readonlyrest-dev}"

# Default poll ceilings. ES gets the longer one: it builds the plugin with Gradle across every
# requested version, and concurrent dispatches queue behind each other when the runner pool is
# busier than the matrix is wide — even on the cheap retag path, where each run still pays runner
# startup, checkout and Gradle cache restore.
ROR_ES_WAIT_TIMEOUT_SECONDS="${ROR_ES_WAIT_TIMEOUT_SECONDS:-$((45 * 60))}"
ROR_KBN_WAIT_TIMEOUT_SECONDS="${ROR_KBN_WAIT_TIMEOUT_SECONDS:-$((30 * 60))}"
ROR_PREBUILD_POLL_INTERVAL_SECONDS="${ROR_PREBUILD_POLL_INTERVAL_SECONDS:-30}"

# --- Image reference helpers -------------------------------------------------------------------

# Fully-qualified dev image refs. Every consumer builds these strings today; centralising them means
# a registry move is a one-line change here instead of a hunt across three repos.
ror_es_dev_image() { echo "${ROR_ES_DEV_IMAGE_REPO}:${1}-ror-${2}"; }
ror_kbn_dev_image() { echo "${ROR_KBN_DEV_IMAGE_REPO}:${1}-ror-${2}"; }

# Checks whether an image tag exists in the remote registry without pulling it.
docker_image_exists() {
  docker manifest inspect "$1" >/dev/null 2>&1
}

# Normalise a space- or comma-separated version list into space-separated tokens, and reject
# anything that is not X.Y.Z[-qualifier]. Both dispatch endpoints accept either separator, so
# consumers may pass "9.4.4" or "9.4.4,9.3.8" or "9.4.4 9.3.8 8.19.19".
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
# Both dispatchers are non-blocking and both are safe to call unconditionally, even when the
# canonical image already exists: the per-run alias tag is only guaranteed to exist because we
# dispatched, and the pipelines' skip optimization turns a "no source changes" dispatch into a cheap
# registry-side retag.
#
# `target_branch` may name a branch that does not exist in the target repo (e.g. a plugin-only or
# e2e-only feature branch). Both pipelines fall back to `develop` in that case, so passing the
# current branch verbatim is always safe.
#
# Both endpoints accept a space- or comma-separated version LIST. The plugin repos call these once
# per version because their pipelines are per-version; a matrix consumer should instead pass every
# version in one call and dispatch twice per run rather than 2×N times.

# Shared mechanics for both dispatches. The two plugin workflows differ only in coordinates, token
# and input KEY names, so the varying `-f key=value` pairs are passed through as trailing args and
# each caller keeps its own names visible at the call site.
#
# No JSON is assembled here any more. The Azure REST body had to be built with `jq --arg` because
# TARGET_BRANCH is chosen by whoever opened the PR and git-check-ref-format(1) permits `"` in a ref
# name, so a printf-interpolated body could close templateParameters and inject sibling top-level
# keys. `gh workflow run -f` passes each value as a single argv entry and gh does the encoding, so
# that whole class of injection is gone rather than merely defended against.
#
# Usage: _dispatch_prebuild_workflow <label> <repo> <workflow> <ref> <token> <-f pairs...>
_dispatch_prebuild_workflow() {
  local LABEL=$1 REPO=$2 WORKFLOW=$3 REF=$4 TOKEN=$5
  shift 5

  local REF_ARGS=()
  [ -n "$REF" ] && REF_ARGS=(--ref "$REF")

  if ! GH_TOKEN="$TOKEN" gh workflow run "$WORKFLOW" -R "$REPO" "${REF_ARGS[@]}" "$@"; then
    echo "ERROR: Failed to dispatch the $LABEL pre-build workflow ($WORKFLOW in $REPO)"
    echo "       On 'workflow not found on the default branch': --ref does not help. GitHub only"
    echo "       registers a workflow_dispatch workflow once the file is on the repo's DEFAULT"
    echo "       branch, and gh resolves it by name against that set before applying --ref. Merge"
    echo "       $WORKFLOW to the default branch of $REPO first; after that any ref can be dispatched."
    return 3
  fi
  echo ">>> Dispatch sent"
}

# Resolves the "auto" workflow-ref policy: use the preferred ref when it exists in the plugin repo,
# otherwise the fallback. A non-"auto" setting is returned verbatim (including empty, which means
# "let gh pick the default branch"). Never fails the dispatch — an API hiccup degrades to the
# fallback rather than blocking the run.
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

# Guards a dispatch token. Empty is the ordinary "secret not configured" case; the `$('*` shape
# catches a CI variable that was never interpolated and arrived as literal expression text, which
# otherwise surfaces much later as a confusing 401.
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

  # snake_case keys — note these differ from the ES workflow's camelCase ones below.
  _dispatch_prebuild_workflow "ROR KBN" \
    "$ROR_KBN_GH_REPO" "$ROR_KBN_PUBLISH_WORKFLOW" "$WORKFLOW_REF" "$KBN_REPO_GH_TOKEN" \
    -f "kbn_versions=$KBN_VERSIONS" \
    -f "target_branch=$TARGET_BRANCH" \
    -f "tag=$RUN_TAG" \
    -f "force_rebuild=$FORCE_REBUILD"
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

  # camelCase keys — the Actions port kept the Azure templateParameters names verbatim, so these do
  # NOT match the KBN workflow's snake_case ones. Getting them wrong is silent: workflow_dispatch
  # ignores unknown inputs and the run builds the wrong thing.
  _dispatch_prebuild_workflow "ROR ES" \
    "$ROR_ES_GH_REPO" "$ROR_ES_PUBLISH_WORKFLOW" "$WORKFLOW_REF" "$ES_REPO_GH_TOKEN" \
    -f "esVersions=$ES_VERSIONS" \
    -f "targetBranch=$TARGET_BRANCH" \
    -f "tag=$RUN_TAG" \
    -f "forceRebuild=$FORCE_REBUILD"
}

# Dispatch both plugins in one go. For consumers that build neither plugin themselves (the e2e repo).
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

# Poll Docker Hub until a per-run image tag appears. Returns quickly when sources are unchanged (the
# pipelines' skip path only does a cheap retag).
# Usage: wait_for_prebuild_image <es|kbn> <version> <run tag> [timeout seconds]
wait_for_prebuild_image() {
  if [ "$#" -lt 3 ]; then
    echo "Usage: wait_for_prebuild_image <es|kbn> <version> <run tag> [timeout seconds]"
    return 1
  fi

  local PLUGIN=$1 VERSION=$2 RUN_TAG=$3 TIMEOUT=${4:-} IMAGE WHERE
  case "$PLUGIN" in
    es)
      IMAGE=$(ror_es_dev_image "$VERSION" "$RUN_TAG")
      TIMEOUT=${TIMEOUT:-$ROR_ES_WAIT_TIMEOUT_SECONDS}
      WHERE="the '$ROR_ES_PUBLISH_WORKFLOW' run in $ROR_ES_GH_REPO"
      ;;
    kbn)
      IMAGE=$(ror_kbn_dev_image "$VERSION" "$RUN_TAG")
      TIMEOUT=${TIMEOUT:-$ROR_KBN_WAIT_TIMEOUT_SECONDS}
      WHERE="the '$ROR_KBN_PUBLISH_WORKFLOW' run in $ROR_KBN_GH_REPO"
      ;;
    *)
      echo "ERROR: wait_for_prebuild_image: plugin must be 'es' or 'kbn', got '$PLUGIN'"
      return 2
      ;;
  esac

  local WAITED=0
  echo ""
  echo ">>> Polling for $IMAGE (timeout: $((TIMEOUT / 60)) min)"
  while ! docker_image_exists "$IMAGE"; do
    if [ "$WAITED" -ge "$TIMEOUT" ]; then
      echo "ERROR: Timed out after $((WAITED / 60)) min waiting for $IMAGE"
      echo "       Check $WHERE."
      return 4
    fi
    sleep "$ROR_PREBUILD_POLL_INTERVAL_SECONDS"
    WAITED=$((WAITED + ROR_PREBUILD_POLL_INTERVAL_SECONDS))
  done

  echo ">>> Dev image is now available: $IMAGE"
}

# Back-compat wrappers: same names and signatures as the copies currently in the plugin repos, so
# adopting this lib there needs no call-site changes.
wait_for_es_prebuild_image() { wait_for_prebuild_image es "$1" "$2"; }
wait_for_kbn_prebuild_image() { wait_for_prebuild_image kbn "$1" "$2"; }

# Wait for both plugins across every version. Waits ES-first: it is the slower side, and by the time
# it lands the KBN images are almost always already there, so the second pass is usually a no-op.
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
