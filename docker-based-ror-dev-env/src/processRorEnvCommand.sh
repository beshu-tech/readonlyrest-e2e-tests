#!/bin/bash -e

cd "$(dirname "$0")"

cd /app

export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm i -g yarn

case "$1" in
    e2e-tests-7x )
      /app/run-env-and-tests.sh "7.17.24" "docker"
      ;;
    e2e-tests-8x )
      /app/run-env-and-tests.sh "8.15.2" "docker"
      ;;
    bash )
      bash
      ;;
    *)
      echo "Unknown command: $1"
      exit 1
      ;;
esac
