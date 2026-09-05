#!/bin/bash
# The eck-ror twin of environments/elk-ror/dump-logs.sh: pod logs, pod status and cluster events
# into <output dir>, one file per pod. Same reason, same contract - it never fails the caller.
#
# Every kubectl call goes through `docker exec eck-ror-control-plane`, the way start.sh does it.
# The host does not necessarily have a kubectl that can reach this kind cluster.
set -uo pipefail

OUT=${1:?Usage: dump-logs.sh <output dir>}
CONTROL_PLANE=${2:-eck-ror-control-plane}

mkdir -p "$OUT" 2>/dev/null || exit 0

kube() { docker exec "$CONTROL_PLANE" kubectl "$@"; }

kube get pods -o wide > "$OUT/pods.txt" 2>&1 || true
kube get events --sort-by=.lastTimestamp > "$OUT/events.txt" 2>&1 || true

for pod in $(kube get pods -o jsonpath='{.items[*].metadata.name}' 2>/dev/null); do
  kube logs "$pod" --all-containers > "$OUT/${pod}.log" 2>&1 || true
done

echo ">>> stack logs written to $OUT"
ls -la "$OUT" 2>/dev/null || true
exit 0
