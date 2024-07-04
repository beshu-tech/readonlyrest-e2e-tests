#!/bin/bash -e

cd "$(dirname "$0")"

validate_version() {
  if ! [[ "$1" =~ ^(?:7\.(?:9|[1-9][0-9]+)\.[0-9]+|(?:[8-9]|[1-9][0-9]+)\.[0-9]+\.[0-9]+)$ ]]
  then
    echo "Invalid version: $1. Should be the raw version without 'v', and >= 7.9.0  i.e. 8.9.3"
    exit 1
  fi
}

# Validate and split ES_VERSIONS into an array
IFS=' ' read -r -a VERSIONS <<< "$ES_VERSIONS"
for version in "${VERSIONS[@]}"
do
  validate_version "$version"
done

PRINTABLE_VERSIONS=$(echo "$*" | tr ' ' ',')
echo "Will build for versions: $PRINTABLE_VERSIONS"

DEST_FOLDER="$(pwd)/../build"
mkdir -p "$DEST_FOLDER"

export DOCKER_RUN_OPTIONS="-v $(realpath $DEST_FOLDER):/app/build_host -e ES_VERSIONS=$*"

./runInDocker.sh build-plugin