#!/bin/bash
# Write the running stack's container logs into <output dir>, one file per container.
#
# This covers the case where the stack came up, the healthchecks passed, and the suite then failed.
# The stack's own log file covers the opposite case, a stack that never came up, so on a test
# failure that file does not exist.
#
# The container list comes from docker, not from `docker compose`, so this needs neither the
# compose file list nor the working directory that the start script assembles them in.
#
# Never fails the caller. It runs on a path that is already failing, and a missing log must not
# replace the real error with an error from collecting logs.
set -uo pipefail

OUT=${1:?Usage: dump-logs.sh <output dir>}

# The compose project name, which is this directory's name, because the start script runs
# `docker compose` here with no -p. Not a parameter: the only caller passes the output dir alone,
# and a second positional would mean something different in the eck-ror twin.
PROJECT=elk-ror

mkdir -p "$OUT" 2>/dev/null || exit 0

# Health status and exit codes first: on a collapse this is usually enough on its own.
docker ps -a --filter "name=^${PROJECT}" \
  --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' > "$OUT/containers.txt" 2>&1 || true

for container in $(docker ps -a --filter "name=^${PROJECT}" --format '{{.Names}}' 2>/dev/null); do
  docker logs "$container" > "$OUT/${container}.log" 2>&1 || true
done

echo ">>> stack logs written to $OUT"
ls -la "$OUT" 2>/dev/null || true
exit 0
