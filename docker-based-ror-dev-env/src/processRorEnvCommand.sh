#!/bin/bash -e

cd "$(dirname "$0")"

cd /app

export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
# The tests run `yarn --frozen-lockfile`. Yarn 2 gave that flag a new name. Thus we must use yarn 1.
# Corepack reads "packageManager" in e2e-tests/package.json. It installs that version of yarn and
# makes sure that the hash agrees.
# The Dockerfile pins NODE_VERSION to v24.11.0, which contains corepack. Node 25 and subsequent
# versions do not contain it. If you increase NODE_VERSION to 25 or more, this command fails. Then
# install corepack in the Dockerfile with `npm i -g corepack`.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable

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
