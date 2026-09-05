#!/bin/bash
# Write the running stack's container logs into <output dir>, one file per container.
#
# Not the same job as print-logs.sh, which cats elk-ror.log. start.sh writes that file only from
# its ERR trap, so it exists only when the stack failed to COME UP. The failures this script is for
# are the opposite: the stack came up, the healthchecks passed, and the Cypress suite then collapsed
# with every spec stuck on /login. Seven of those between 12 Aug and 4 Sep, and none of them left a
# single line of Kibana or Elasticsearch log behind to explain it.
#
# Reads the containers straight from docker rather than from `docker compose`, so it needs neither
# the compose file list that start.sh assembles nor the working directory it assembles them in.
#
# Never fails the caller. It runs on a path that is already failing, and a missing log must not
# replace the real error with an error from collecting logs.
set -uo pipefail

OUT=${1:?Usage: dump-logs.sh <output dir>}
PROJECT=${2:-elk-ror}

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
