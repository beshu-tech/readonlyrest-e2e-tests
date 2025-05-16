#!/bin/bash -e

cd "$(dirname "$0")"

if [ -z "$ROR_ACTIVATION_KEY" ]; then
  echo "ROR_ACTIVATION_KEY env is not set (see https://github.com/beshu-tech/readonlyrest-e2e-tests/blob/master/README.md#troubleshooting to figure out how to obtain the key and set it)"
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "At least one parameter is required: 1) KBN version [2) run type (run|open), default: run]"
  exit 1
fi

export ELECTRON_EXTRA_LAUNCH_ARGS="--disable-gpu"
KBN_VERSION="$1"
RUN_TYPE="${2:-run}" # Default to "run" if not provided

# Validate run type
if [[ "$RUN_TYPE" != "run" && "$RUN_TYPE" != "open" ]]; then
  echo "Run type must be 'run' or 'open'"
  exit 1
fi

echo "Running E2E Cypress tests (mode: $RUN_TYPE) ..."

yarn --frozen-lockfile install

if [[ "$RUN_TYPE" == "open" ]]; then
  yarn open --env="kibanaVersion=$KBN_VERSION,enterpriseActivationKey=$ROR_ACTIVATION_KEY"
else
  yarn run run --env="kibanaVersion=$KBN_VERSION,enterpriseActivationKey=$ROR_ACTIVATION_KEY"
fi

if [[ $? -ne 0 ]]; then
  echo "❌ E2E tests failed :("
  exit 1
fi

echo "✅ E2E tests result: SUCCESS"