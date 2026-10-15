#!/bin/bash -e
# TEMPORARY (RORDEV-2283). Remove this script and its call in runner.sh when the tested ReadonlyREST
# KBN release has the RORDEV-2283 fix (readonlyrest_kbn#1105).
#
# A Kibana node whose first ReadonlyREST start-up attempt fails on an Elasticsearch error never
# answers a user request, while its health check passes. The suite would then fail every spec. This
# script restarts such a replica once, with a warning that names the defect, so that the run still
# tests the rest. It hides the defect from the run result: the warning is the record. A replica that
# still does not answer stops the run with an error.

cd "$(dirname "$0")"
source ../common/kibana-answers.sh

# The start script runs `docker compose` in this directory, so the compose project is its name.
for container in $(docker ps -q --filter label=com.docker.compose.project=elk-ror --filter label=com.docker.compose.service=kbn-ror); do
  name=$(docker inspect -f '{{.Name}}' "$container")
  name=${name#/}
  has_rordev_2283 "$name" docker exec "$container" cat "$ROR_KBN_PACKAGE_JSON" || continue
  probe=(docker exec "$container" "${KIBANA_PROBE_CURL[@]}" https://localhost:5601/api/spaces/space)
  kibana_answers "${probe[@]}" && continue

  echo "::warning title=RORDEV-2283::Kibana replica $name does not answer user requests after its start-up. It is restarted once."
  docker restart "$container" >/dev/null
  deadline=$((SECONDS + 300))
  until [ "$(docker inspect -f '{{.State.Health.Status}}' "$container")" = healthy ]; do
    [ "$SECONDS" -lt "$deadline" ] || break
    sleep 5
  done
  if ! kibana_answers "${probe[@]}"; then
    echo "::error title=RORDEV-2283::Kibana replica $name still does not answer after the restart."
    exit 1
  fi
done
