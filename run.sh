#!/bin/bash -e

if [ $# -ne 1 ]; then
  echo "One parameter is required: 1) ELK version"
  exit 1
fi

ELK_VERSION="$1"

cleanup() {
  ./elk-ror/stop-and-clean.sh 
}

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

time ./elk-ror/start.sh --es "$ELK_VERSION" --kbn "$ELK_VERSION"
time ./e2e-tests/run.sh "$ELK_VERSION"