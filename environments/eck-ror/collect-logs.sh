#!/bin/bash
# The eck-ror twin of the elk-ror collector: pod logs, pod status and cluster events into
# <output dir>, one file per pod. Same contract, same two failure shapes, same --console flag.
#
# Every kubectl call goes through `docker exec` on the control-plane node. The host does not
# necessarily have a kubectl that can reach this kind cluster.
#
# Never fails the caller.
set -uo pipefail

OUT=${1:?Usage: collect-logs.sh <output dir> [--console]}
CONSOLE=${2:-}

# The kind node.
CONTROL_PLANE=eck-ror-control-plane

mkdir -p "$OUT" 2>/dev/null || exit 0

kube() { docker exec "$CONTROL_PLANE" kubectl "$@"; }

# -A everywhere: ES and Kibana are in `default`, but on an ECK failure the operator's log is
# usually the one that explains it, and that lives in elastic-system.
kube get pods -A -o wide > "$OUT/pods.txt" 2>&1 || true
kube get events -A --sort-by=.lastTimestamp > "$OUT/events.txt" 2>&1 || true

# `<namespace> <name>` pairs, so a pod outside `default` is fetched from the right namespace.
kube get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace} {.metadata.name}{"\n"}{end}' 2>/dev/null |
  while read -r ns pod; do
    [ -n "$pod" ] || continue
    kube logs -n "$ns" "$pod" --all-containers > "$OUT/${ns}_${pod}.log" 2>&1 || true
    # A container that crashed and restarted: the live log is the new process, not the one that
    # died. Best effort - most pods have no previous instance, and that is not an error here.
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
