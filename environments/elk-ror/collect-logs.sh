#!/bin/bash
# Collect everything this environment knows about a failure into <output dir>, one file per source.
#
# There are two failure shapes and they leave their evidence in different places:
#
#   1. The stack never came up. start.sh writes the compose log to elk-ror.log and stops. The
#      containers may not exist, so `docker logs` has nothing to give.
#   2. The stack came up and the suite failed. There is no elk-ror.log, and the per-container
#      logs are the only record.
#
# One script covers both, so the two paths cannot drift apart. The caller says which shape it has
# with --console: shape 1 has a short job log and needs the stack log on the console, shape 2 has
# the whole Cypress output on the console already and only needs the files.
#
# The container list comes from docker, not from `docker compose`, so this needs neither the
# compose file list nor the working directory that the start script assembles them in.
#
# Never fails the caller. It runs on a path that is already failing, and a missing log must not
# replace the real error with an error from collecting logs.
set -uo pipefail

OUT=${1:?Usage: collect-logs.sh <output dir> [--console]}
CONSOLE=${2:-}

cd "$(dirname "$0")" || exit 0
# The caller gives the output dir relative to the repository root, which is where it runs. This
# script moves to its own directory to reach elk-ror.log, so resolve the path before the move.
case $OUT in /*) ;; *) OUT=$(cd ../.. && pwd)/$OUT ;; esac

# The compose project name, which is this directory's name, because the start script runs
# `docker compose` here with no -p.
PROJECT=elk-ror

mkdir -p "$OUT" 2>/dev/null || exit 0

# Health status and exit codes first: on a collapse this is usually enough on its own.
docker ps -a --filter "name=^${PROJECT}" \
  --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' > "$OUT/containers.txt" 2>&1 || true

for container in $(docker ps -a --filter "name=^${PROJECT}" --format '{{.Names}}' 2>/dev/null); do
  docker logs "$container" > "$OUT/${container}.log" 2>&1 || true
done

# Only shape 1 leaves this behind. Keep it next to the per-container logs so the reader has one
# place to look, whichever shape the failure had.
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
