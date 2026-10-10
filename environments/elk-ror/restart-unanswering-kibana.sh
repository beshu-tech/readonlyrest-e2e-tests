#!/bin/bash -e
# TEMPORARY (RORDEV-2283). Remove this script and its call in runner.sh when the tested ReadonlyREST
# KBN release has the RORDEV-2283 fix (readonlyrest_kbn#1105).
#
# A Kibana node whose first ReadonlyREST start-up attempt fails on an Elasticsearch error never
# answers a user request, while its health check passes. The suite would then fail every spec. This
# script restarts such a replica once, with a warning that names the defect, so that the run still
# tests the rest. It hides the defect from the run result: the warning is the record.

cd "$(dirname "$0")"
source ../common/kibana-answers.sh

for container in $(docker ps -q --filter label=com.docker.compose.service=kbn-ror); do
  name=$(docker inspect -f '{{.Name}}' "$container")
  probe=(docker exec "$container" "${KIBANA_PROBE_CURL[@]}" https://localhost:5601/api/spaces/space)
  kibana_answers "${probe[@]}" && continue

  echo "::warning title=RORDEV-2283::Kibana replica ${name#/} does not answer user requests after its start-up. It is restarted once."
  docker restart "$container" >/dev/null
  deadline=$((SECONDS + 300))
  until [ "$(docker inspect -f '{{.State.Health.Status}}' "$container")" = healthy ]; do
    [ "$SECONDS" -lt "$deadline" ] || break
    sleep 5
  done
  # The suite's own gate reports a replica that still does not answer.
  kibana_answers "${probe[@]}" || echo "::warning title=RORDEV-2283::Kibana replica ${name#/} still does not answer after the restart."
done
