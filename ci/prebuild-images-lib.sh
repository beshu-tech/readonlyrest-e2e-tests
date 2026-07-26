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
# Required tooling is needed only at call time, not at source time: `gh` for the KBN dispatch,
# `curl` + `jq` for the ES dispatch, `docker` for the polls. A consumer that never calls a given
# function never needs its tools.
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

# ROR KBN pre-builds: a GitHub Actions workflow dispatched with the `gh` CLI.
ROR_KBN_GH_REPO="${ROR_KBN_GH_REPO:-sscarduzio/readonlyrest_kbn}"
ROR_KBN_PUBLISH_WORKFLOW="${ROR_KBN_PUBLISH_WORKFLOW:-publish-pre-builds.yml}"

# ROR ES pre-builds: an Azure DevOps pipeline dispatched over the REST API (.azure/publish-pre-builds.yml
# in the ES repo, definitionId=7). Hardcoded by convention — only the auth token is a secret. The
# project name is URL-encoded because it contains spaces.
ROR_ES_AZURE_ORG="${ROR_ES_AZURE_ORG:-beshu-tech}"
ROR_ES_AZURE_PROJECT="${ROR_ES_AZURE_PROJECT:-ReadonlyREST%20for%20Elasticsearch}"
ROR_ES_AZURE_PIPELINE_ID="${ROR_ES_AZURE_PIPELINE_ID:-7}"

ROR_ES_DEV_IMAGE_REPO="${ROR_ES_DEV_IMAGE_REPO:-beshultd/elasticsearch-readonlyrest-dev}"
ROR_KBN_DEV_IMAGE_REPO="${ROR_KBN_DEV_IMAGE_REPO:-beshultd/kibana-readonlyrest-dev}"

# Default poll ceilings. ES gets the longer one: several dispatches can land on the same Azure
# pipeline definition at once and queue behind each other if the org has fewer free parallel jobs
# than legs — even on the cheap retag path, where each run still pays agent startup, checkout and
# Gradle cache restore.
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

  # The `$('*` check catches an Azure DevOps variable that was never resolved and arrived as the
  # literal expression text, which otherwise fails much later with a confusing 401.
  if [ -z "${KBN_REPO_GH_TOKEN:-}" ] || [[ "${KBN_REPO_GH_TOKEN}" == '$('* ]]; then
    echo "ERROR: KBN_REPO_GH_TOKEN is not set or was not resolved (required to dispatch the ROR KBN pre-build workflow)"
    return 2
  fi

  echo ""
  echo ">>> Dispatching ROR KBN pre-build: versions=$KBN_VERSIONS tag=$RUN_TAG branch=$TARGET_BRANCH"
  if ! GH_TOKEN="$KBN_REPO_GH_TOKEN" gh workflow run "$ROR_KBN_PUBLISH_WORKFLOW" \
        -R "$ROR_KBN_GH_REPO" \
        -f "kbn_versions=$KBN_VERSIONS" \
        -f "target_branch=$TARGET_BRANCH" \
        -f "tag=$RUN_TAG" \
        -f "force_rebuild=$FORCE_REBUILD"; then
    echo "ERROR: Failed to dispatch the ROR KBN pre-build workflow"
    return 3
  fi
  echo ">>> Dispatch sent"
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

  if [ -z "${ES_REPO_AZURE_PAT:-}" ] || [[ "${ES_REPO_AZURE_PAT}" == '$('* ]]; then
    echo "ERROR: ES_REPO_AZURE_PAT is not set or was not resolved (required to dispatch the ES pre-build pipeline)"
    return 2
  fi

  local API_URL="https://dev.azure.com/${ROR_ES_AZURE_ORG}/${ROR_ES_AZURE_PROJECT}/_apis/pipelines/${ROR_ES_AZURE_PIPELINE_ID}/runs?api-version=7.1"

  # Build the request body with jq, NOT printf: TARGET_BRANCH is chosen by whoever opened the PR,
  # and git-check-ref-format(1) allows `"` in a ref name. A printf-interpolated body would let a
  # branch name close the templateParameters object and inject sibling top-level keys — e.g.
  # resources.repositories.self.refName, which pins the ref the Azure pipeline executes from.
  # jq --arg does the JSON escaping, so the value can only ever land as a string.
  local BODY
  BODY=$(jq -nc \
    --arg esVersions "$ES_VERSIONS" \
    --arg targetBranch "$TARGET_BRANCH" \
    --arg tag "$RUN_TAG" \
    --arg forceRebuild "$FORCE_REBUILD" \
    '{templateParameters: {esVersions: $esVersions, targetBranch: $targetBranch, tag: $tag, forceRebuild: $forceRebuild}}') || return 3

  # `base64 | tr -d '\n'` rather than `base64 -w0`: the latter is GNU-only and dies on BSD/macOS,
  # which matters the first time someone debugs this from a laptop.
  local AUTH
  AUTH=$(printf ':%s' "$ES_REPO_AZURE_PAT" | base64 | tr -d '\n')

  echo ""
  echo ">>> Dispatching ROR ES pre-build: versions=$ES_VERSIONS tag=$RUN_TAG branch=$TARGET_BRANCH"
  local RESPONSE_FILE HTTP_STATUS
  RESPONSE_FILE=$(mktemp)
  HTTP_STATUS=$(curl -s -o "$RESPONSE_FILE" -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Basic $AUTH" \
    "$API_URL" \
    -d "$BODY")

  if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
    echo "ERROR: Failed to dispatch ES pre-build pipeline (HTTP $HTTP_STATUS)"
    cat "$RESPONSE_FILE"
    rm -f "$RESPONSE_FILE"
    return 3
  fi
  rm -f "$RESPONSE_FILE"
  echo ">>> Dispatch sent (HTTP $HTTP_STATUS)"
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
      WHERE="the publish-pre-builds pipeline run in the ROR ES repo"
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
