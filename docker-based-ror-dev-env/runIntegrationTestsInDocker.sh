#!/bin/bash -e

cd "$(dirname "$0")"

if [[ -z "${ROR_ACTIVATION_KEY}" ]]; then
  echo "ROR_ACTIVATION_KEY is not set or is empty"
  exit 1
fi

export DOCKER_RUN_OPTIONS="-e ROR_ACTIVATION_KEY=$ROR_ACTIVATION_KEY"

./runInDocker.sh integration-tests
