#!/bin/bash -e

cd "$(dirname "$0")"

echo "Stopping and cleaning environment the tests were being run at ..."

DOCKER_COMPOSE_FILES="-f base.docker-compose.yml -f apm.docker-compose.yml"
docker compose $DOCKER_COMPOSE_FILES rm --stop --force

echo "Done!"