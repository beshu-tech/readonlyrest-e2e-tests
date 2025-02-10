#!/bin/bash -e

show_help() {
  echo "Usage: ./run-evn-and-tests.sh --env <docker|eck> --elk <elk_version> [--ror-es <ror_es_version> (default: latest) --ror-kbn <ror_kbn_version> (default: latest) --dev (use dev images)]"
  exit 1
}

ENV_NAME=""
ELK_VERSION="$1"
ROR_ES_VERSION=""
ROR_KBN_VERSION=""
MODE=""

while [[ $# -gt 0 ]]; do
  case $1 in
  --env)
    if [[ -n $2 && $2 != --* ]]; then
      case "$2" in
        "docker")
          ENV_NAME="elk-ror"
          ;;
        "eck")
          ENV_NAME="eck-ror"
          ;;
        *)
          echo "Error: --env: Only "docker" and 'eck' are available environments"
          show_help
          ;;
      esac
      shift 2
    else
      echo "Error: --env requires a version argument"
      show_help
    fi
    ;;
  --elk)
    if [[ -n $2 && $2 != --* ]]; then
      ELK_VERSION="$2"
      shift 2
    else
      echo "Error: --elk requires a version argument"
      show_help
    fi
    ;;
  --ror-es)
    if [[ -n $2 && $2 != --* ]]; then
      ROR_ES_VERSION="--ror-es $2"
      shift 2
    else
      echo "Error: --ror-es requires a version argument"
      show_help
    fi
    ;;
  --ror-kbn)
    if [[ -n $2 && $2 != --* ]]; then
      ROR_KBN_VERSION="--ror-kbn $2"
      shift 2
    else
      echo "Error: --ror-kbn requires a version argument"
      show_help
    fi
    ;;
  --dev)
    MODE="--dev"
    shift
    ;;
  *)
    echo "Unknown option: $1"
    show_help
    ;;
  esac
done

handle_error() {
  df -h
  ./environments/"$ENV_NAME"/print-logs.sh
}

cleanup() {
  df -h
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

time ./environments/$ENV_NAME/start.sh --es "$ELK_VERSION" --kbn "$ELK_VERSION" $ROR_ES_VERSION $ROR_KBN_VERSION $MODE
time ./e2e-tests/run-tests.sh "$ELK_VERSION"

df -h
