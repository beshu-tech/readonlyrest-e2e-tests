#!/usr/bin/env bash
# resolve-test-versions.sh e2e|bootstrap
# Prints one JSON object: {"ror_version": "<latest ROR release>", "elk_versions": ["<ELK version>", ...]},
# newest ELK version first. The argument is the run type of `runner.sh --run`.
#
# The ROR API gives the latest ROR release and the ELK versions it supports. When the API gives no
# answer, the script fails: a run must not test something other than the release it names.
set -euo pipefail

ROR_API="https://api.beshu.tech/list_es_versions"

main() {
  local run_type=${1:-} listing ror_version supported elk_versions
  case "$run_type" in
    e2e|bootstrap) ;;
    *) echo "usage: resolve-test-versions.sh e2e|bootstrap" >&2; exit 1 ;;
  esac

  listing=$(retry 3 fetch "$ROR_API")
  ror_version=$(latest_ror_release <<< "$listing")
  supported=$(elk_supported_versions <<< "$listing")

  case "$run_type" in
    e2e)       elk_versions=$(latest_of_each_major_and_of_two_newest_minors <<< "$supported") ;;
    bootstrap) elk_versions=$(latest_of_each_minor <<< "$supported") ;;
  esac

  if [ "$(jq length <<< "$elk_versions")" -eq 0 ]; then
    echo "The ROR API lists no ELK version that both plugins support." >&2
    exit 1
  fi
  jq -cn --arg r "$ror_version" --argjson v "$elk_versions" '{ror_version: $r, elk_versions: $v}'
}

fetch() {
  curl -fsS --connect-timeout 10 --max-time 30 "$1"
}

latest_ror_release() {
  jq -er '.pluginVersion | select(test("^[0-9]+\\.[0-9]+\\.[0-9]+$"))'
}

# The ELK versions that both the ES and the Kibana plugin support.
elk_supported_versions() {
  jq -c '. as $r | [$r.es[] | select(. as $v | $r.kbn_universal | index($v))]'
}

# The jq filters below take and give a JSON list of versions. The list they give is newest first.
JQ_VERSION_DEFS='
  def parts: split(".") | map(tonumber);
  def latest_per_minor: group_by(parts[0:2]) | map(max_by(parts));
  def newest_first: sort_by(parts) | reverse;'

latest_of_each_minor() {
  jq -c "$JQ_VERSION_DEFS latest_per_minor | newest_first"
}

# The latest version of each major from 7, and of the two newest minors of the newest major.
latest_of_each_major_and_of_two_newest_minors() {
  jq -c "$JQ_VERSION_DEFS
    latest_per_minor
    | (map(parts[0]) | max) as \$newest_major
    | group_by(parts[0])
    | map(select(.[0] | parts[0] >= 7) | newest_first | if (.[0] | parts[0]) == \$newest_major then .[0:2] else .[0:1] end)
    | flatten
    | newest_first"
}

cd "$(dirname "$0")/../.."
source environments/common/retry.sh
main "$@"
