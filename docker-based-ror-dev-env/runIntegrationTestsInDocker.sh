#!/bin/bash -e

cd "$(dirname "$0")"

if [[ -z "${ROR_ACTIVATION_KEY}" ]]; then
  echo "ROR_ACTIVATION_KEY is not set or is empty"
  exit 1
fi

DEST_FOLDER="$(pwd)/../automatic-tests/cypress/videos"
rm -rf "$DEST_FOLDER"
mkdir -p "$DEST_FOLDER"
chmod -R 777 "$DEST_FOLDER"
DEST_FOLDER=$(realpath "$DEST_FOLDER")

export DOCKER_RUN_OPTIONS="-v $DEST_FOLDER:/app/automatic-tests/cypress/videos -e ROR_ACTIVATION_KEY=$ROR_ACTIVATION_KEY"

./runInDocker.sh integration-tests
