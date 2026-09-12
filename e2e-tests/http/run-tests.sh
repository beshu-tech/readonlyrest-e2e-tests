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
  echo "One parameter is required: 1) the Kibana version under test [2) environment name: elk-ror|eck-ror]"
  exit 1
fi

export KIBANA_VERSION="$1"
# runner.sh knows which environment it booted. Only a failure message reads it.
export ENV_NAME="${2:-unknown}"

# Every deadline in this suite, in one place. The per-test one has to hold several requests, and
# the last one caps the whole run: no broken environment can spend a CI leg here again.
TEST_TIMEOUT_MS="${HTTP_TEST_TIMEOUT_MS:-90000}"
SUITE_TIMEOUT_SECONDS="${HTTP_SUITE_TIMEOUT_SECONDS:-600}"

echo "Checking that the stack is up ..."
node http/wait-for-stack.js

echo "Running HTTP API tests ..."

# One file at a time. Every file here rewrites the ReadonlyREST settings that the whole stack
# reads, so two of them in parallel would take each other's configuration away.
# `timeout` is coreutils. macOS ships it as gtimeout, or not at all; the run is then bounded by the
# per-test deadline alone, which is the developer's own machine and not a CI leg.
TIMEOUT_CMD=""
if command -v timeout &>/dev/null; then
  TIMEOUT_CMD="timeout --foreground $SUITE_TIMEOUT_SECONDS"
elif command -v gtimeout &>/dev/null; then
  TIMEOUT_CMD="gtimeout --foreground $SUITE_TIMEOUT_SECONDS"
else
  echo "No 'timeout' command: the run is bounded by --test-timeout only."
fi

set +e
$TIMEOUT_CMD node --test --test-concurrency=1 --test-timeout="$TEST_TIMEOUT_MS" http/*.test.js
STATUS=$?
set -e

if [ "$STATUS" -eq 124 ]; then
  echo "❌ HTTP API tests did not finish within ${SUITE_TIMEOUT_SECONDS}s and were stopped."
  exit 1
fi

if [ "$STATUS" -ne 0 ]; then
  echo "❌ HTTP API tests failed :("
  exit "$STATUS"
fi

echo "✅ HTTP API tests result: SUCCESS"
