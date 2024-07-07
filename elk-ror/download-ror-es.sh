#!/bin/bash -e

cd "$(dirname "$0")"

if [ $# -ne 1 ]; then
  echo "One parameter is required: 1) ES version"
  exit 1
fi

ES_VERSION="$1"

mkdir -p ../plugins
ES_PLUGIN_FILENAME="ROR-latest-for-ES-$ES_VERSION.zip"

curl -s -L -D - -o "../plugins/$ES_PLUGIN_FILENAME" "https://api.beshu.tech/download/es?esVersion=$ES_VERSION&email=ror-e2e-tests%40readonlyrest.com" > /dev/null 2>&1

echo "$ES_PLUGIN_FILENAME"