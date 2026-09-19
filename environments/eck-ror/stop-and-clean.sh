#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Log the last cluster state before the cluster is deleted, for failure analysis.
echo "== final pod status before teardown =="
kubectl --request-timeout=10s get pods -A 2>/dev/null || true
echo "== final warning events before teardown =="
kubectl --request-timeout=10s get events -A --field-selector=type=Warning \
  --sort-by=.lastTimestamp \
  -o custom-columns='LAST:.lastTimestamp,COUNT:.count,NS:.metadata.namespace,REASON:.reason,OBJECT:.involvedObject.name,MESSAGE:.message' \
  2>/dev/null | tail -25 || true

kind delete cluster --name eck-ror
