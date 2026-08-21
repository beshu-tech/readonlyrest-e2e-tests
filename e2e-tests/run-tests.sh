#!/bin/bash -e

cd "$(dirname "$0")"

NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [ -s "$NVM_SCRIPT" ]; then
  source "$NVM_SCRIPT"
  nvm install
  nvm use
else
  REQUIRED_NODE="24.11.0"
  CURRENT_NODE="$(node --version 2>/dev/null | sed 's/v//')"
  if ! node --version &>/dev/null || ! printf '%s\n%s' "$REQUIRED_NODE" "$CURRENT_NODE" | sort -V -C; then
    echo "Node.js >=$REQUIRED_NODE is required but found: ${CURRENT_NODE:-none}"
    echo "Install nvm (https://github.com/nvm-sh/nvm) or install Node.js $REQUIRED_NODE manually"
    exit 1
  fi
fi

if [ -z "$ROR_ACTIVATION_KEY" ]; then
  echo "ROR_ACTIVATION_KEY env is not set (see https://github.com/beshu-tech/readonlyrest-e2e-tests/blob/master/README.md#troubleshooting to figure out how to obtain the key and set it)"
  exit 1
fi

if [ $# -lt 1 ]; then
  echo "At least one parameter is required: 1) KBN version [2) run type (run|open), default: run]"
  exit 1
fi

KBN_VERSION="$1"
ENV_NAME="$2"
RUN_TYPE="${3:-run}" # Default to "run" if not provided
# Validate run type
if [[ "$RUN_TYPE" != "run" && "$RUN_TYPE" != "open" ]]; then
  echo "Run type must be 'run' or 'open'"
  exit 1
fi

# Validate ENV_NAME
if [[ "$ENV_NAME" != "elk-ror" && "$ENV_NAME" != "eck-ror" ]]; then
  echo "ENV_NAME must be a type 'elk-ror' or 'eck-ror'"
  exit 1
fi

echo "Running E2E Cypress tests (mode: $RUN_TYPE) ..."

yarn --frozen-lockfile install

if [[ "$RUN_TYPE" == "open" ]]; then
  yarn open --env="kibanaVersion=$KBN_VERSION,enterpriseActivationKey=$ROR_ACTIVATION_KEY,envName=$ENV_NAME"
else
  mkdir -p ../results

  set +e
  yarn run run --env="kibanaVersion=$KBN_VERSION,enterpriseActivationKey=$ROR_ACTIVATION_KEY,envName=$ENV_NAME" 2>&1 |
    while IFS= read -r LINE || [[ -n "$LINE" ]]; do
      printf '%s\n' "${LINE//"$ROR_ACTIVATION_KEY"/***}"
    done |
    tee ../results/cypress.log
  CYPRESS_EXIT_CODE=${PIPESTATUS[0]}
  set -e

  if [[ "$CYPRESS_EXIT_CODE" -ne 0 ]]; then
    echo "❌ E2E tests failed :("
    exit "$CYPRESS_EXIT_CODE"
  fi
fi

echo "✅ E2E tests result: SUCCESS"
