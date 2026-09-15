#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# runner.sh runs this via `trap cleanup EXIT`, so it fires before the calling GitHub Actions step
# returns - including the "Stop Docker memory monitor" step, whose final log lines were always
# empty ("== kubectl pod status ==" with nothing after it) because `kind delete cluster` below had
# already torn the cluster down by the time that step's `kubectl` calls ran. Dumping the pod/event
# state here, one last time before deletion, keeps a non-empty final snapshot for post-mortem.
echo "== final pod status before teardown =="
kubectl --request-timeout=10s get pods -A 2>/dev/null || true
echo "== final warning events before teardown =="
kubectl --request-timeout=10s get events -A --field-selector=type=Warning \
  --sort-by=.lastTimestamp \
  -o custom-columns='LAST:.lastTimestamp,COUNT:.count,NS:.metadata.namespace,REASON:.reason,OBJECT:.involvedObject.name,MESSAGE:.message' \
  2>/dev/null | tail -25 || true

kind delete cluster --name eck-ror
