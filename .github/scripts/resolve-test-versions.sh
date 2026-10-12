#!/usr/bin/env bash
# resolve-test-versions.sh e2e|bootstrap [--check-images]
# Prints one JSON object: {"ror": "<latest ROR release>", "versions": ["<ELK version>", ...]}, newest
# version first. The rules are in CI.md ("Versions under test").
#
# The ROR API gives the latest release and the ELK versions it supports. With --check-images, Docker
# Hub must also have both plugin images of that release for every version in the list. When the API
# gives no answer, or an image is missing, the script fails: a run must not test something other than
# the release it names.
set -euo pipefail

cd "$(dirname "$0")/../.."
source environments/common/retry.sh

KIND=${1:?usage: resolve-test-versions.sh e2e|bootstrap [--check-images]}
CHECK_IMAGES=${2:-}
API="https://api.beshu.tech/list_es_versions"
HUB="https://hub.docker.com/v2/repositories"
IMAGE_REPOS=(beshultd/elasticsearch-readonlyrest beshultd/kibana-readonlyrest)

get() {
  curl -fsS --connect-timeout 10 --max-time 30 "$1"
}

listing=$(retry 3 get "$API")
ror=$(jq -er '.pluginVersion | select(test("^[0-9]+\\.[0-9]+\\.[0-9]+$"))' <<< "$listing")

# A version counts when both plugins support it. e2e: the latest version of each major from 7, and of
# the two newest minors of the newest major. bootstrap: the latest version of each minor.
versions=$(jq -c --arg kind "$KIND" '
  def key: split(".") | map(tonumber);
  . as $r
  | [$r.es[] | select(. as $v | $r.kbn_universal | index($v))]
  | group_by(key[0:2]) | map(max_by(key)) as $per_minor
  | if $kind == "bootstrap" then $per_minor
    elif $kind == "e2e" then
      ($per_minor | map(key[0]) | max) as $newest
      | $per_minor | group_by(key[0])
      | map(select(.[0] | key[0] >= 7) | sort_by(key) | reverse | if (.[0] | key[0]) == $newest then .[0:2] else .[0:1] end)
      | flatten
    else error("unknown kind \($kind)") end
  | sort_by(key) | reverse' <<< "$listing")
[ "$(jq length <<< "$versions")" -gt 0 ] || { echo "The ROR API lists no ELK version that both plugins support." >&2; exit 1; }

# Every tag of the release, page after page.
release_tags() {
  local url="$HUB/$1/tags?name=-ror-$ror&page_size=100" page
  while [ -n "$url" ] && [ "$url" != null ]; do
    page=$(retry 3 get "$url")
    jq -r '.results[].name' <<< "$page"
    url=$(jq -r '.next' <<< "$page")
  done
}

if [ "$CHECK_IMAGES" = --check-images ]; then
  missing=()
  for repo in "${IMAGE_REPOS[@]}"; do
    tags=$(release_tags "$repo")
    while IFS= read -r version; do
      grep -qxF -- "$version-ror-$ror" <<< "$tags" || missing+=("$repo:$version-ror-$ror")
    done < <(jq -r '.[]' <<< "$versions")
  done
  if [ ${#missing[@]} -gt 0 ]; then
    echo "ROR $ror is released, but Docker Hub has no image ${missing[*]}." >&2
    exit 1
  fi
fi

jq -cn --arg ror "$ror" --argjson versions "$versions" '{ror: $ror, versions: $versions}'
