#!/bin/bash
# Probe each Kibana replica directly, past kbn-proxy, and print one line per replica. Exit 0 when
# every replica answers, 1 when one does not.
#
# Usage: probe-kibana.sh [--wait <seconds>]
#   --wait  probe again every 5 s until every replica answers, for at most <seconds>.
#
# Two requests per replica, sent from inside its container:
#   status  /api/status as the kibana user. Kibana core answers it.
#   ror     /api/spaces/space as admin. ROR KBN authenticates the user against ES first.
# A replica that hangs in ROR KBN answers `status` and not `ror`, so only `ror` decides. A status
# from 100 to 499 counts as an answer: a 401 or a 403 still proves the request path works. A hung
# replica sends no status at all, and curl prints 000.
set -uo pipefail

PROJECT=elk-ror
REQUEST_TIMEOUT=10

WAIT=0
if [ "${1:-}" = "--wait" ]; then WAIT=${2:?Usage: probe-kibana.sh [--wait <seconds>]}; fi

replicas() {
  docker ps -a --filter "name=^${PROJECT}-kbn-ror-" --format '{{.Names}}' 2>/dev/null | sort
}

# Prints "<http code> <seconds>". `timeout` also stops a docker exec that hangs.
request() {
  local container=$1 path=$2 credentials=$3 out
  out=$(timeout $((REQUEST_TIMEOUT + 5)) docker exec "$container" \
    curl -sk -o /dev/null -m "$REQUEST_TIMEOUT" -w '%{http_code} %{time_total}s' \
    -u "$credentials" "https://localhost:5601$path" 2>/dev/null)
  echo "${out:-000 no-exec}"
}

answers() { [[ $1 =~ ^[1-4][0-9][0-9]\  ]]; }

probe_once() {
  local all_ok=0 container ip health status ror verdict
  local names
  names=$(replicas)
  if [ -z "$names" ]; then
    echo "no ${PROJECT}-kbn-ror-* container found"
    return 1
  fi
  for container in $names; do
    ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$container" 2>/dev/null)
    health=$(docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}} failing-streak={{.State.Health.FailingStreak}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null)
    status=$(request "$container" /api/status kibana:kibana)
    ror=$(request "$container" /api/spaces/space admin:dev)
    if answers "$ror"; then verdict=answers; else verdict="DOES NOT ANSWER"; all_ok=1; fi
    printf '%s\tip=%s\t%s\tstatus=%s\tror=%s\t%s\n' "$container" "${ip% }" "$health" "$status" "$ror" "$verdict"
  done
  return $all_ok
}

deadline=$((SECONDS + WAIT))
while true; do
  result=$(probe_once)
  rc=$?
  if [ $rc -eq 0 ] || [ $SECONDS -ge $deadline ]; then
    echo "$result"
    exit $rc
  fi
  sleep 5
done
