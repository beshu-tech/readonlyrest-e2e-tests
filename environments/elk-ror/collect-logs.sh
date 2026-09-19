#!/bin/bash
# Collect container status, per-container logs and the compose startup log into <output dir>, one
# file per source. --console also prints the compose startup log on the console.
#
# The container list comes from docker, not from `docker compose`: this needs neither the compose
# file list nor the working directory that the start script assembles them in.
#
# Never fails the caller: a missing log must not replace the real error with an error from here.
set -uo pipefail

OUT=${1:?Usage: collect-logs.sh <output dir> [--console]}
CONSOLE=${2:-}

cd "$(dirname "$0")" || exit 0
# A relative <output dir> is relative to the repository root, not to this directory.
case $OUT in /*) ;; *) OUT=$(cd ../.. && pwd)/$OUT ;; esac

# The compose project name: the start script runs `docker compose` in this directory with no -p.
PROJECT=elk-ror

mkdir -p "$OUT" 2>/dev/null || exit 0

# Status and exit codes: on a collapse this is often enough on its own. RestartCount tells a
# container that died and came back from one that never died: `docker ps` shows only the current
# process.
{
  printf 'NAMES\tSTATUS\tRESTARTS\tIMAGE\n'
  for container in $(docker ps -a --filter "name=^${PROJECT}" --format '{{.Names}}' 2>/dev/null); do
    docker inspect -f '{{.Name}}{{"\t"}}{{.State.Status}}{{"\t"}}{{.RestartCount}}{{"\t"}}{{.Config.Image}}' "$container" 2>&1 | sed 's|^/||'
  done
} > "$OUT/containers.txt" 2>&1 || true

# Docker keeps the output of every process a restart policy replaced, so the log also holds why
# each earlier process died. --timestamps lines the deaths up with the Cypress timeline.
for container in $(docker ps -a --filter "name=^${PROJECT}" --format '{{.Names}}' 2>/dev/null); do
  docker logs --timestamps "$container" > "$OUT/${container}.log" 2>&1 || true
done

# The start script writes this log only when the stack fails to come up.
[ -f "$PROJECT.log" ] && cp "$PROJECT.log" "$OUT/compose-startup.log" 2>/dev/null

echo ">>> stack logs written to $OUT"
cat "$OUT/containers.txt" 2>/dev/null || true

if [ "$CONSOLE" = "--console" ]; then
  echo "Logs from docker compose:"
  echo "-----------------------------------------------------------------------"
  cat "$OUT/compose-startup.log" 2>/dev/null
  echo "-----------------------------------------------------------------------"
fi

exit 0
