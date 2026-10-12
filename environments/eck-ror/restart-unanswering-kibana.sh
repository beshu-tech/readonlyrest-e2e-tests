#!/bin/bash -e
# TEMPORARY (RORDEV-2283). Remove this script and its call in runner.sh when the tested ReadonlyREST
# KBN release has the RORDEV-2283 fix (readonlyrest_kbn#1105).
#
# A Kibana node whose first ReadonlyREST start-up attempt fails on an Elasticsearch error never
# answers a user request, while its health check passes. The suite would then fail every spec. This
# script restarts such a node once, with a warning that names the defect, so that the run still
# tests the rest. It hides the defect from the run result: the warning is the record. ECK runs one
# Kibana pod, so the probe goes through the exposed port.

cd "$(dirname "$0")"
source ../common/kibana-answers.sh

kubectl_in_cluster() { docker exec eck-ror-control-plane kubectl "$@"; }
probe=("${KIBANA_PROBE_CURL[@]}" https://localhost:5601/api/spaces/space)
kibana_answers "${probe[@]}" && exit 0

echo "::warning title=RORDEV-2283::The Kibana pod does not answer user requests after its start-up. It is restarted once."
kubectl_in_cluster delete pod -l kibana.k8s.elastic.co/name=eck-ror --wait=true
deadline=$((SECONDS + 600))
until [ "$(kubectl_in_cluster get kibana eck-ror -o jsonpath='{.status.health}' 2>/dev/null)" = green ] &&
  kibana_answers "${probe[@]}"; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    # The suite's own gate reports a pod that still does not answer.
    echo "::warning title=RORDEV-2283::The Kibana pod still does not answer after the restart."
    break
  fi
  sleep 10
done
