#!/bin/bash -e

# The HTTP-only part of the suite. These tests only call the ES and the Kibana API, so they need
# neither a browser nor `yarn install`: Node's own test runner and its own fetch are enough.
#
# It runs against the stack runner.sh already started, immediately before the Cypress suite.

cd "$(dirname "$0")/.."

# The same guard as run-tests.sh, because this script runs before it. .nvmrc sits one level up,
# which is the directory this script changed to.
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

if [ $# -lt 1 ]; then
  echo "One parameter is required: the Kibana version under test"
  exit 1
fi

export KIBANA_VERSION="$1"

echo "Running HTTP API tests ..."

# One file at a time. Every file here rewrites the ReadonlyREST settings that the whole stack
# reads, so two of them in parallel would take each other's configuration away.
node --test --test-concurrency=1 http/*.test.js

echo "✅ HTTP API tests result: SUCCESS"
