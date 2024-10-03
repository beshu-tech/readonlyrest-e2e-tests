#!/bin/bash -e

if [ $# -ne 2 ]; then
  echo "Two parameters are required: 1) ELK version 2) enviroment name (available options: docker, eck)"
  exit 1
fi

ELK_VERSION="$1"
ENV_NAME=""
case "$2" in
  "docker")
    ENV_NAME="elk-ror"
    ;;
  "eck")
    ENV_NAME="eck-ror"
    ;;
  *)
    echo 'Only "docker" and 'eck' are available environments'
    exit 2;
    ;;
esac

handle_error() {
  ./environments/"$ENV_NAME"/print-logs.sh
}

cleanup() {
  ./environments/"$ENV_NAME"/stop-and-clean.sh 
}

trap handle_error ERR
trap cleanup EXIT

echo -e "

  _____                _  ____        _       _____  ______  _____ _______
 |  __ \              | |/ __ \      | |     |  __ \|  ____|/ ____|__   __|
 | |__) |___  __ _  __| | |  | |_ __ | |_   _| |__) | |__  | (___    | |
 |  _  // _ \/ _| |/ _| | |  | | '_ \| | | | |  _  /|  __|  \___ \   | |
 | | \ \  __/ (_| | (_| | |__| | | | | | |_| | | \ \| |____ ____) |  | |
 |_|  \_\___|\__,_|\__,_|\____/|_| |_|_|\__, |_|  \_\______|_____/   |_|
                                         __/ |
"

echo -e "E2E TESTS\n"

time ./environments/$ENV_NAME/start.sh --es "$ELK_VERSION" --kbn "$ELK_VERSION"
time ./e2e-tests/run-tests.sh "$ELK_VERSION"