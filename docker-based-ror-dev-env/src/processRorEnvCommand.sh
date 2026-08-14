#!/bin/bash -e

cd "$(dirname "$0")"

cd /app

export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
# Range-pinned: the suite installs with --frozen-lockfile against a v1 yarn.lock, so yarn 2+ (which
# renamed that flag) must never be picked up. See "packageManager" in e2e-tests/package.json.
npm i -g 'yarn@^1.22.22'

case "$1" in
    e2e-tests-7x )
      /app/runner.sh --run e2e --elk "7.17.24" --env "docker"
      ;;
    e2e-tests-8x )
      /app/runner.sh --run e2e --elk "8.15.2" --env "docker"
      ;;
    bash )
      bash
      ;;
    *)
      echo "Unknown command: $1"
      exit 1
      ;;
esac
