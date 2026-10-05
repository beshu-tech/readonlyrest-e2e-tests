#!/bin/bash
# Tells when the prod start retry in environments/elk-ror/start.sh can go:
# https://github.com/beshu-tech/readonlyrest-e2e-tests/issues/146
#
# The retry covers a Kibana crash at boot that sscarduzio/readonlyrest_kbn#1075 fixes. For each
# version in ELK_VERSIONS, this finds the ROR KBN release behind the <version>-ror-latest image: the
# release tag whose image has the same digest. Then GitHub tells if that tag contains the fix commit.
#
# Exit codes:
#   0  keep the retry: a version runs a release without the fix, or the retry is gone.
#   1  remove the retry: every version runs a release with the fix, and a default of
#      MAX_RESTARTS_PER_CONTAINER in start.sh is still above 0.
#   2  the check cannot run.
#
# Needs `gh` with a token that reads the contents of sscarduzio/readonlyrest_kbn, a private repo.
# Without it, GitHub refuses the tag list and the compare call.
#
# Docker Hub gets HEAD requests only. They return the digest, and Docker Hub does not count them as
# pulls, so the check uses none of the pull rate limit.
set -uo pipefail

FIX_COMMIT=${FIX_COMMIT:-7dc92d539cdd324c348895917cc24242b357ca1e}
ROOT=${E2E_DIR:-$(git rev-parse --show-toplevel)}
KBN_REPO=sscarduzio/readonlyrest_kbn
IMAGE_REPO=beshultd/kibana-readonlyrest
ISSUE=https://github.com/beshu-tech/readonlyrest-e2e-tests/issues/146

cannot_run() {
  echo "::error title=Start retry check::$1"
  exit 2
}

versions=$(sed -n 's/^ *ELK_VERSIONS: *"\(.*\)".*/\1/p' \
  "$ROOT/.github/workflows/all-e2e-tests.yml" "$ROOT/.github/workflows/bootstrap-tests.yml" | tr ' ' '\n' | sort -uV)
[ -n "$versions" ] || cannot_run "No ELK_VERSIONS in all-e2e-tests.yml or bootstrap-tests.yml."

# git gets the token from gh. The empty extraheader drops the token that actions/checkout can leave in
# the repo config: that token reads this repo only, so GitHub refuses it for the plugin repo.
tags=$(git -c credential.helper= -c 'credential.helper=!gh auth git-credential' -c 'http.https://github.com/.extraheader=' \
  ls-remote --tags --refs "https://github.com/$KBN_REPO.git" 'v*_kbn*' | sed 's|.*refs/tags/||')
[ -n "$tags" ] || cannot_run "Cannot list the tags of $KBN_REPO. The token of gh must read its contents."

registry_token=$(curl -fsS "https://auth.docker.io/token?service=registry.docker.io&scope=repository:$IMAGE_REPO:pull" | jq -r .token)
[ -n "$registry_token" ] && [ "$registry_token" != null ] || cannot_run "No Docker Hub token for $IMAGE_REPO."

# Prints the digest of an image tag, and nothing when the tag does not exist. Fails on any answer
# other than 200 or 404.
digest() {
  local headers
  headers=$(curl -sSI -H "Authorization: Bearer $registry_token" \
    -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json' \
    "https://registry-1.docker.io/v2/$IMAGE_REPO/manifests/$1" | tr -d '\r') || return 1
  case $(awk 'NR == 1 { print $2 }' <<< "$headers") in
    200) awk -F': ' 'tolower($1) == "docker-content-digest" { print $2 }' <<< "$headers" ;;
    404) ;;
    *) return 1 ;;
  esac
}

all_fixed=true
for version in $versions; do
  latest=$(digest "$version-ror-latest") || cannot_run "Docker Hub did not answer for $IMAGE_REPO:$version-ror-latest."
  release=""
  if [ -n "$latest" ]; then
    for candidate in $(sed -n "s/^v\(.*\)_kbn${version//./\\.}\$/\1/p" <<< "$tags" | sort -rV); do
      candidate_digest=$(digest "$version-ror-$candidate") || cannot_run "Docker Hub did not answer for $IMAGE_REPO:$version-ror-$candidate."
      if [ "$candidate_digest" = "$latest" ]; then
        release=$candidate
        break
      fi
    done
  fi
  if [ -z "$release" ]; then
    echo "::warning title=Start retry check::$version: no release tag has the image of $version-ror-latest, so this version counts as not fixed."
    all_fixed=false
    continue
  fi
  status=$(gh api "repos/$KBN_REPO/compare/$FIX_COMMIT...v${release}_kbn$version?per_page=1" --jq .status) \
    || cannot_run "Cannot compare commits in $KBN_REPO. The token of gh must read its contents."
  # ahead or identical: the tag contains the fix commit.
  case $status in
    ahead|identical) fixed=yes ;;
    *) fixed=no; all_fixed=false ;;
  esac
  echo "$version: -ror-latest is ROR KBN $release. Contains the fix: $fixed ($status)."
done

highest_default=$(sed -n 's/.*MAX_RESTARTS_PER_CONTAINER:-\([0-9][0-9]*\).*/\1/p' "$ROOT/environments/elk-ror/start.sh" | sort -n | tail -n 1)
echo "The highest default of MAX_RESTARTS_PER_CONTAINER in start.sh: ${highest_default:-none}."

if ! $all_fixed; then
  echo "Keep the retry: not every version runs a ROR KBN release with the fix."
  exit 0
fi
if (( ${highest_default:-0} > 0 )); then
  echo "::error title=Remove the prod start retry::Every ELK_VERSIONS image runs a ROR KBN release with the fix of sscarduzio/readonlyrest_kbn#1075, and start.sh still retries a prod start. Follow $ISSUE"
  exit 1
fi
echo "Every version has the fix, and the retry is gone. Delete this check: $ISSUE"
