#!/bin/bash -e

# Writes a kibana.yml into every kbn-ror replica, restarts them, and waits until all are healthy.
#
# Every replica must run the same config: kbn-proxy sends each request to any of them. The
# /pkp/api/kibanaConfig endpoint of the ROR Kibana plugin cannot do this here. It rewrites the file
# of the replica that answers, and restarts only that one.
#
# Usage: set-kibana-config.sh <kibana.yml>

if [[ ! -f "$1" ]]; then
  echo "Usage: $0 <kibana.yml>: '$1' is not a file"
  exit 1
fi
CONFIG_FILE="$(realpath "$1")"

# Docker Compose names the project after the directory of start.sh, and labels each container
# with its project and its service.
PROJECT="${COMPOSE_PROJECT_NAME:-elk-ror}"
mapfile -t REPLICAS < <(docker ps -q \
  --filter "label=com.docker.compose.project=$PROJECT" \
  --filter "label=com.docker.compose.service=kbn-ror")
if [[ ${#REPLICAS[@]} -eq 0 ]]; then
  echo "No kbn-ror container is running"
  exit 2
fi

# Write as the kibana user, into the existing file. The file then keeps the owner and the mode
# that the image gives it, and the plugin endpoint can still rewrite it.
for replica in "${REPLICAS[@]}"; do
  docker exec -i -u kibana "$replica" sh -c 'cat > /usr/share/kibana/config/kibana.yml' < "$CONFIG_FILE"
done

docker restart "${REPLICAS[@]}" > /dev/null

# A restarted container reports "starting" until its first health check passes. The compose
# health check gives a booting replica 180 s, plus 30 checks 10 s apart.
TIMEOUT_IN_SECONDS=480
deadline=$((SECONDS + TIMEOUT_IN_SECONDS))
for replica in "${REPLICAS[@]}"; do
  until [[ "$(docker inspect -f '{{.State.Health.Status}}' "$replica")" == "healthy" ]]; do
    if (( SECONDS >= deadline )); then
      echo "kbn-ror replica $replica is not healthy after ${TIMEOUT_IN_SECONDS}s with $CONFIG_FILE"
      docker logs --tail 50 "$replica" || true
      exit 3
    fi
    sleep 5
  done
done

echo "All ${#REPLICAS[@]} kbn-ror replicas run $CONFIG_FILE"
