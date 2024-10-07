#!/bin/bash -e

cd "$(dirname "$0")"

if [ $# -ne 1 ]; then
  echo "One parameter is required: 1) KBN version"
  exit 1
fi

KBN_VERSION="$1"

mkdir -p images/plugins
KBN_PLUGIN_FILENAME="ROR-latest-for-KBN-$KBN_VERSION.zip"

curl -s -L -D - -o "images/plugins/$KBN_PLUGIN_FILENAME" "https://api.beshu.tech/download/kbn?esVersion=$KBN_VERSION&edition=kbn_universal&email=ror-e2e-tests%40readonlyrest.com" > /dev/null 2>&1

echo "$KBN_PLUGIN_FILENAME"