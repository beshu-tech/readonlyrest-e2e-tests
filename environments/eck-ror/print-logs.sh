#!/bin/bash -e

cd "$(dirname "$0")"

for pod in $(docker exec eck-ror-control-plane kubectl get pods --output=jsonpath='{.items[*].metadata.name}'); do
  echo "Logs from pod: $pod":
  echo ""
  kubectl logs $pod
  echo "--------------------------------------------------"
done
