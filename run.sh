#!/bin/bash -e

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

ELK_VERSION="8.14.1"

time ./elk-ror/run.sh --es "$ELK_VERSION" --kbn "$ELK_VERSION"
time ./e2e-tests/run.sh "$ELK_VERSION"