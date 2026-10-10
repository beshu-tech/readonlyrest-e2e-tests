#!/usr/bin/env bash
# resolve-ror-latest.sh <ELK version>...
# Prints, as one JSON object, the ROR version that the released `<ELK version>-ror-latest` image of
# each plugin is today: {"9.5.5": {"es": "1.71.0", "kbn": "1.71.0"}, ...}.
#
# `-ror-latest` moves when ROR releases. A run that gives each leg the fixed version from here tests
# the same images on every leg, even when a release lands during the run.
#
# Asks the Docker Hub API, not the registry, so it costs no pull. A version that cannot be resolved
# gets "latest" and a warning: the leg then runs as it did before this script.
set -euo pipefail

cd "$(dirname "$0")/.."
source environments/common/retry.sh

HUB="https://hub.docker.com/v2/repositories"
ES_REPO="beshultd/elasticsearch-readonlyrest"
KBN_REPO="beshultd/kibana-readonlyrest"

hub_get() {
  curl -fsS --connect-timeout 10 --max-time 20 "$1"
}

# The <elk>-ror-<x.y.z> tag that has the same digest as <elk>-ror-latest.
resolve() {
  local repo=$1 elk=$2 digest tags
  digest=$(retry 3 hub_get "$HUB/$repo/tags/$elk-ror-latest" | jq -er '.digest') || return 1
  tags=$(retry 3 hub_get "$HUB/$repo/tags?name=$elk-ror-&ordering=last_updated&page_size=100") || return 1
  jq -r --arg d "$digest" --arg p "$elk-ror-" '
      .results[] | select(.digest == $d) | .name
      | select(startswith($p)) | ltrimstr($p) | select(test("^[0-9]+\\.[0-9]+\\.[0-9]+$"))' <<< "$tags" |
    sort -V | tail -1 | grep .
}

result='{}'
for elk in "$@"; do
  for plugin in es kbn; do
    repo=$ES_REPO
    [ "$plugin" = kbn ] && repo=$KBN_REPO
    if ! version=$(resolve "$repo" "$elk"); then
      echo "::warning title=ROR version::Cannot resolve $repo:$elk-ror-latest to a version. The legs use the moving tag." >&2
      version=latest
    fi
    result=$(jq -c --arg e "$elk" --arg p "$plugin" --arg v "$version" '.[$e][$p] = $v' <<< "$result")
  done
done
echo "$result"
