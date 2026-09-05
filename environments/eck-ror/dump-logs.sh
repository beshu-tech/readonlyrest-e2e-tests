#!/bin/bash
# The eck-ror twin of environments/elk-ror/dump-logs.sh: pod logs, pod status and cluster events
# into <output dir>, one file per pod. Same reason, same contract - it never fails the caller.
#
# Every kubectl call goes through `docker exec eck-ror-control-plane`, the way start.sh does it.
# The host does not necessarily have a kubectl that can reach this kind cluster.
set -uo pipefail

OUT=${1:?Usage: dump-logs.sh <output dir>}

# The kind node, named by start.sh. Not a parameter - the only caller passes the output dir alone.
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
ls -la "$OUT" 2>/dev/null || true
exit 0
