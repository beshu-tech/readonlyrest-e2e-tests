#!/bin/bash -e

cd "$(dirname "$0")"

if [ -z "$ROR_ACTIVATION_KEY" ]; then
  echo "ROR_ACTIVATION_KEY env is not set (see https://github.com/beshu-tech/readonlyrest-e2e-tests/blob/master/README.md#troubleshooting to figure out how to obtain the key and set it)"
  exit 1
fi

if [ $# -ne 1 ]; then
  echo "One parameter is required: 1) KBN version"
  exit 1
fi

KBN_VERSION="$1"

echo "Running E2E Cypress tests ..."

yarn --frozen-lockfile install
yarn run run --env="kibanaVersion=$KBN_VERSION,enterpriseActivationKey=$ROR_ACTIVATION_KEY"

if [[ $? -ne 0 ]]; then
  echo "❌ E2E tests failed :("
  exit 1
fi

echo "✅ E2E tests result: SUCCESS"