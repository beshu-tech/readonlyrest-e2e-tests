#!/bin/bash -e

cd "$(dirname "$0")"

cd /app

export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm i -g yarn

case "$1" in
    e2e-tests-7x )
      /app/main.sh --mode e2e --elk "7.17.24" --env "docker"
      ;;
    e2e-tests-8x )
      /app/main.sh --mode e2e --elk "8.15.2" --env "docker"
      ;;
    bash )
      bash
      ;;
    *)
      echo "Unknown command: $1"
      exit 1
      ;;
esac
