#!/bin/bash

cd "$(dirname "$0")"

OUT=${1:?Usage: print-logs.sh <output dir>}
mkdir -p "$OUT"

# Only a stack that did not start leaves this file.
if [ -f elk-ror.log ]; then
  echo "Logs from docker compose:"
  echo "-----------------------------------------------------------------------"
  cat elk-ror.log
  echo "-----------------------------------------------------------------------"
  cp elk-ror.log "$OUT/compose-startup.log"
fi

# Docker keeps the output of a process that a restart policy replaced, so the log also holds why
# each earlier process died. The file gets the whole log; the console gets the tail.
for container in $(docker ps -a --filter 'name=^elk-ror' --format '{{.Names}}'); do
  restarts=$(docker inspect -f '{{.RestartCount}}' "$container")
  docker logs --timestamps "$container" > "$OUT/$container.log" 2>&1
  echo "--- $container (RestartCount=$restarts, full log in $OUT/$container.log) ---"
  tail -200 "$OUT/$container.log"
done
