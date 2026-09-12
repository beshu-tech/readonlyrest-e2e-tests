#!/bin/bash
# The one place that decides which (ELK version, environment) pairs the e2e suite runs on.
#
# Before this script the version list lived twice in all-e2e-tests.yml — once in the prod matrix
# and once in ELK_VERSIONS for the dev image pre-build — under a comment asking the reader to keep
# them in sync. Now both read it from here.
#
# Why the pairs are not a cross product. Over 75 nightly runs the two ECK operator versions
# disagreed on 8 of 300 paired observations, every one a singleton that did not repeat the next
# night. The operator version is orthogonal to the ELK version, so testing all four ELK versions
# against both operators buys a third more legs and no information. docker is different: it
# disagreed with ECK 23 times, 19 of them in the same direction, because it runs two Kibana
# replicas behind a proxy where ECK runs one.
#
# So every ELK version gets docker plus ONE operator, and the operators alternate down the list.
# `--flip` swaps which operator each version takes, so the nightly covers the pairs the pull
# requests do not. Every cell is therefore visited within 24 hours.
#
# Usage: e2e-matrix.sh versions|matrix [--flip]
set -euo pipefail

# Keep newest first: a failure on the newest line is the one worth seeing first in the UI.
ELK_VERSIONS=("9.5.3" "9.4.6" "8.19.21" "7.17.29")
ECK_ENVS=("eck-3.5.0" "eck-2.16.1")

MODE=${1:?Usage: e2e-matrix.sh versions|matrix [--flip]}
FLIP=0
[ "${2:-}" = "--flip" ] && FLIP=1

case $MODE in
  versions)
    printf '%s\n' "${ELK_VERSIONS[@]}" | jq -Rcn '[inputs]'
    ;;
  matrix)
    {
      for v in "${ELK_VERSIONS[@]}"; do printf '%s docker\n' "$v"; done
      i=0
      for v in "${ELK_VERSIONS[@]}"; do
        printf '%s %s\n' "$v" "${ECK_ENVS[$(( (i + FLIP) % ${#ECK_ENVS[@]} ))]}"
        i=$(( i + 1 ))
      done
    } | jq -Rcn '{include: [inputs | split(" ") | {version: .[0], env: .[1]}]}'
    ;;
  *)
    echo "Usage: e2e-matrix.sh versions|matrix [--flip]" >&2
    exit 2
    ;;
esac
