#!/bin/bash -e

cd "$(dirname "$0")"

DOCKER_BASED_ROR_DEV_ENV_HASH=$(./rorDevEnvVersion.sh)

if [[ -n $(docker images -q "e2e-tests-dev-env":"$DOCKER_BASED_ROR_DEV_ENV_HASH") ]]; then
  echo "Docker image e2e-tests-dev-env:$DOCKER_BASED_ROR_DEV_ENV_HASH already present. Skipping building process!"
else
  ./buildRorDevEnvImage.sh "$DOCKER_BASED_ROR_DEV_ENV_HASH"
fi
