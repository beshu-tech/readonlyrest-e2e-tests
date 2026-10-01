#!/bin/bash
# Probe each Kibana pod directly, past the service, and print one line per pod. Exit 0 when every
# pod answers, 1 when one does not.
#
# Usage: probe-kibana.sh [--wait <seconds>]
#   --wait  probe again every 5 s until every pod answers, for at most <seconds>.
#
# Two requests per pod, sent from inside its kibana container:
#   status  /api/status as the kibana user. Kibana core answers it.
#   ror     /api/spaces/space as admin. ROR KBN authenticates the user against ES first.
# A pod that hangs in ROR KBN answers `status` and not `ror`, so only `ror` decides. A status from
# 100 to 499 counts as an answer: a 401 or a 403 still proves the request path works. A hung pod
# sends no status at all, and curl prints 000.
#
# kubectl runs inside the control-plane node: the host does not necessarily have a kubectl that can
# reach this kind cluster.
set -uo pipefail

CONTROL_PLANE=eck-ror-control-plane
SELECTOR=kibana.k8s.elastic.co/name=eck-ror
REQUEST_TIMEOUT=10

WAIT=0
if [ "${1:-}" = "--wait" ]; then WAIT=${2:?Usage: probe-kibana.sh [--wait <seconds>]}; fi

kube() { timeout $((REQUEST_TIMEOUT + 10)) docker exec "$CONTROL_PLANE" kubectl "$@"; }

# Prints "<http code> <seconds>".
request() {
  local pod=$1 path=$2 credentials=$3 out
  out=$(kube exec "$pod" -c kibana -- \
    curl -sk -o /dev/null -m "$REQUEST_TIMEOUT" -w '%{http_code} %{time_total}s' \
    -u "$credentials" "https://localhost:5601$path" 2>/dev/null)
  echo "${out:-000 no-exec}"
}

answers() { [[ $1 =~ ^[1-4][0-9][0-9]\  ]]; }

probe_once() {
  local all_ok=0 pod ip ready restarts status ror verdict pods
  pods=$(kube get pods -l "$SELECTOR" \
    -o jsonpath='{range .items[*]}{.metadata.name} {.status.podIP} {.status.containerStatuses[0].ready} {.status.containerStatuses[0].restartCount}{"\n"}{end}' 2>/dev/null)
  if [ -z "$pods" ]; then
    echo "no pod matches $SELECTOR"
    return 1
  fi
  while read -r pod ip ready restarts; do
    [ -n "$pod" ] || continue
    status=$(request "$pod" /api/status kibana:kibana)
    ror=$(request "$pod" /api/spaces/space admin:dev)
    if answers "$ror"; then verdict=answers; else verdict="DOES NOT ANSWER"; all_ok=1; fi
    printf '%s\tip=%s\tready=%s restarts=%s\tstatus=%s\tror=%s\t%s\n' "$pod" "$ip" "$ready" "$restarts" "$status" "$ror" "$verdict"
  done <<< "$pods"
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
