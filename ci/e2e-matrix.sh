#!/bin/bash
# The one source of the ELK versions the e2e suite runs on. The prod matrix and the dev image
# pre-build both read it from here.
#
# Usage: e2e-matrix.sh versions          the versions, as a JSON list
#        e2e-matrix.sh matrix <env>...   a GitHub Actions matrix: every version on every given env
set -euo pipefail

# Newest first: a failure on the newest line is the one to see first in the run UI.
ELK_VERSIONS=("9.5.3" "9.4.6" "8.19.21" "7.17.29")

usage() {
  echo "Usage: e2e-matrix.sh versions | matrix <env>..." >&2
  exit 2
}

versions_json() {
  printf '%s\n' "${ELK_VERSIONS[@]}" | jq -Rcn '[inputs]'
}

MODE=${1:-}
case $MODE in
  versions)
    [ "$#" -eq 1 ] || usage
    versions_json
    ;;
  matrix)
    shift
    [ "$#" -ge 1 ] || usage
    ENVS_JSON=$(printf '%s\n' "$@" | jq -Rcn '[inputs]')
    jq -cn --argjson version "$(versions_json)" --argjson env "$ENVS_JSON" '{version: $version, env: $env}'
    ;;
  *)
    usage
    ;;
esac
