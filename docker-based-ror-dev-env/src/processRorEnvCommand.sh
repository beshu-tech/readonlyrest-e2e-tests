#!/bin/bash -e

cd "$(dirname "$0")"

cd /app

export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm i -g yarn

case "$1" in
    e2e-tests-7x )
      /app/run-7x.sh
      ;;
    e2e-tests-8x )
      /app/run-8x.sh
      ;;
    bash )
      bash
      ;;
    *)
      echo "Unknown command: $1"
      exit 1
      ;;
esac
