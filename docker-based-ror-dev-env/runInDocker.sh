#!/bin/bash -e

if [ $# -eq 0 ]; then
    echo "At least one param with command passed to the env has to be passed"
    exit 1
fi

cd "$(dirname "$0")"

if [[ -z "${ROR_ACTIVATION_KEY}" ]]; then
  echo "ROR_ACTIVATION_KEY is not set or is empty"
  exit 1
fi

COMMAND=$1
DOCKER_BASED_ROR_DEV_ENV_HASH=$(./src/rorDevEnvVersion.sh)

if [[ -n $(docker images -q e2e-tests-dev-env:"$DOCKER_BASED_ROR_DEV_ENV_HASH") ]]; then
  echo "Found docker image for ROR KBN env: e2e-tests-dev-env:$DOCKER_BASED_ROR_DEV_ENV_HASH"
else
  ./src/buildRorDevEnvImage.sh "$DOCKER_BASED_ROR_DEV_ENV_HASH"
fi

DIND_OPTIONS=""
if docker info | grep -i runtime | grep -q sysbox-runc; then
  DIND_OPTIONS="--runtime=sysbox-runc" 
else
  DIND_OPTIONS="--privileged"
fi

docker run --rm $DIND_OPTIONS $DOCKER_RUN_OPTIONS \
  -e ROR_ACTIVATION_KEY=$ROR_ACTIVATION_KEY \
  -v ./../e2e-tests:/app/e2e-tests \
  -v ./../elk-ror:/app/elk-ror \
  -v ./../run.sh:/app/run.sh \
  -v ./../results:/app/results \
  e2e-tests-dev-env:"$DOCKER_BASED_ROR_DEV_ENV_HASH" "$COMMAND"
