#!/usr/bin/env bash
# Fails when a network step of the pipeline or of an environment runs without a retry: a
# `docker pull`, an `npm install` or `npm ci`, or a `kubectl apply|create -f <URL>`. The e2e suite
# has no retry of its own, so one dropped connection fails the whole leg.
#
# A line passes when it calls the `retry <attempts>` helper, or when it is the head of an
# `until ...; do` loop. kubectl gets no exception: download the manifest with `retry`, then apply
# the file.
set -euo pipefail

cd "$(dirname "$0")/.."

offending=$(
  grep -rnE --include='*.sh' --include='Dockerfile*' --include='*.yml' --include='*.yaml' \
    -e 'docker +pull' -e 'npm +(install|i|ci)\b' -e 'kubectl +(apply|create)\b.*-f +"?https?://' \
    .github environments ci runner.sh e2e-tests/run-tests.sh |
    grep -v '^ci/check-network-retries\.sh:' |
    grep -vE '^[^:]+:[0-9]+:[[:space:]]*#' |
    grep -vE 'retry [0-9]+ |until ' || true
)

if [ -n "$offending" ]; then
  echo "A network step has no retry. Wrap it in 'retry <attempts>' (environments/common/retry.sh)," >&2
  echo "or in an 'until' loop where the helper is not available:" >&2
  echo "$offending" >&2
  exit 1
fi
echo "Every network step has a retry."
