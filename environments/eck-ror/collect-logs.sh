#!/bin/bash
# Collect pod status, cluster events and pod logs into <output dir>, one file per pod. --console
# also prints the events and the pod logs on the console.
#
# kubectl runs inside the control-plane node: the host does not necessarily have a kubectl that
# can reach this kind cluster.
#
# Never fails the caller: a missing log must not replace the real error with an error from here.
set -uo pipefail

OUT=${1:?Usage: collect-logs.sh <output dir> [--console]}
CONSOLE=${2:-}

CONTROL_PLANE=eck-ror-control-plane

mkdir -p "$OUT" 2>/dev/null || exit 0

kube() { docker exec "$CONTROL_PLANE" kubectl "$@"; }

# -A: ES and Kibana are in `default`, but the operator log that explains an ECK failure is in
# elastic-system.
kube get pods -A -o wide > "$OUT/pods.txt" 2>&1 || true
kube get events -A --sort-by=.lastTimestamp > "$OUT/events.txt" 2>&1 || true

kube get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace} {.metadata.name}{"\n"}{end}' 2>/dev/null |
  while read -r ns pod; do
    [ -n "$pod" ] || continue
    kube logs -n "$ns" "$pod" --all-containers > "$OUT/${ns}_${pod}.log" 2>&1 || true
    # After a crash and a restart the live log is the new process, not the one that died. Most
    # pods have no previous instance, and that is not an error here.
    kube logs -n "$ns" "$pod" --all-containers --previous > "$OUT/${ns}_${pod}.previous.log" 2>/dev/null ||
      rm -f "$OUT/${ns}_${pod}.previous.log"
  done

echo ">>> stack logs written to $OUT"
cat "$OUT/pods.txt" 2>/dev/null || true

if [ "$CONSOLE" = "--console" ]; then
  echo "Cluster events:"
  echo "-----------------------------------------------------------------------"
  cat "$OUT/events.txt" 2>/dev/null
  for log in "$OUT"/*.log; do
    [ -f "$log" ] || continue
    echo "Logs from pod: $(basename "$log" .log)":
    echo ""
    cat "$log"
    echo "--------------------------------------------------"
  done
fi

exit 0
