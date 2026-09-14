#!/bin/bash

cd "$(dirname "$0")"

OUT=${1:?Usage: print-logs.sh <output dir>}
mkdir -p "$OUT"

for pod in $(docker exec eck-ror-control-plane kubectl get pods --output=jsonpath='{.items[*].metadata.name}'); do
  echo "Logs from pod: $pod":
  echo ""
  kubectl logs "$pod" | tee "$OUT/$pod.log"
  # The container that ran before the current one. Only a pod that restarted has one.
  kubectl logs --previous "$pod" > "$OUT/$pod.previous.log" 2>/dev/null || rm -f "$OUT/$pod.previous.log"
  echo "--------------------------------------------------"
done
