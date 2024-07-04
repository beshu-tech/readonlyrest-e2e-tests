#!/bin/bash -ex

cd "$(dirname "$0")"

if [ -z "$ROR_ACTIVATION_KEY" ]; then
  echo "ROR_ACTIVATION_KEY is not set"
  exit 1
fi

CURRENT_KIBANA_VERSION="8.14.1"

yarn install
yarn run run --env="kibanaVersion=$CURRENT_KIBANA_VERSION,enterpriseActivationKey=$ROR_ACTIVATION_KEY"

if [[ $? -ne 0 ]]; then
  echo "❌ Integration tests failed :("
  exit 1
fi

echo "✅ Integration tests: SUCCESS"