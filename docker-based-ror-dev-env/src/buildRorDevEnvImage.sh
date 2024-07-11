#!/bin/bash -e

if [ $# -ne 1 ]; then
    echo "The script requires one argument: 1) e2e-tests-dev-env image tag"
    exit 1
fi

cd "$(dirname "$0")"

ROR_DEV_IMAGE_TAG="$1"

echo "Building Docker image for ROR DEV environment - e2e-tests-dev-env:$ROR_DEV_IMAGE_TAG ..."

HOST_UID=$(id -u)
HOST_GID=$(id -g)

docker buildx build --build-arg UID="$HOST_UID" --build-arg GID="$HOST_GID" --no-cache --load -t e2e-tests-dev-env:"$ROR_DEV_IMAGE_TAG" -f Dockerfile ../../

echo "DONE!"