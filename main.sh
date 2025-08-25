#!/bin/bash -e

show_help() {
  echo "Usage: ./main.sh --mode <e2e|bootstrap> (default: e2e) --env <docker|eck-x.y.z> --elk <elk_version> [--ror-es <ror_es_version> (default: latest) --ror-kbn <ror_kbn_version> (default: latest) --dev (use dev images)"
  exit 1
}

ENV_NAME=""
ELK_VERSION="$1"
OPTIONAL_ECK_ARG=""
OPTIONAL_ROR_ES_ARG=""
OPTIONAL_ROR_KBN_ARG=""
OPTIONAL_DEV_ARG=""
OPTIONAL_RUN_MODE=""

while [[ $# -gt 0 ]]; do
  case $1 in
  --mode)
    if [[ -n $2 && $2 != --* ]]; then
      case "$2" in
        "e2e")
          OPTIONAL_RUN_MODE="e2e"
          ;;
        "bootstrap")
          OPTIONAL_RUN_MODE="bootstrap"
          ;;
        *)
          echo "Error: --mode: Only 'e2e' and 'bootstrap' are supported"
          show_help
          ;;
      esac
      shift 2
    else
      echo "Error: --mode requires an argument (e2e or bootstrap)"
      show_help
    fi
    ;;
  --env)
    if [[ -n $2 && $2 != --* ]]; then
      case "$2" in
        "docker")
          ENV_NAME="elk-ror"
          ;;
        eck-*)
          ENV_NAME="eck-ror"
          OPTIONAL_ECK_ARG="--eck ${2#eck-}"
          ;;
        *)
          echo "Error: --env: Only 'docker' and 'eck-x.y.z' patterns are supported"
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
      OPTIONAL_ROR_ES_ARG="--ror-es $2"
      shift 2
    else
      echo "Error: --ror-es requires a version argument"
      show_help
    fi
    ;;
  --ror-kbn)
    if [[ -n $2 && $2 != --* ]]; then
      OPTIONAL_ROR_KBN_ARG="--ror-kbn $2"
      shift 2
    else
      echo "Error: --ror-kbn requires a version argument"
      show_help
    fi
    ;;
  --dev)
    OPTIONAL_DEV_ARG="--dev"
    shift
    ;;
  *)
    echo "Unknown option: $1"
    show_help
    ;;
  esac
done

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

echo -e "Running environment...\n"

#time ./environments/$ENV_NAME/start.sh --es "$ELK_VERSION" --kbn "$ELK_VERSION" $OPTIONAL_ECK_ARG $OPTIONAL_ROR_ES_ARG $OPTIONAL_ROR_KBN_ARG $OPTIONAL_DEV_ARG

if [[ "$OPTIONAL_RUN_MODE" == "e2e" ]]; then
  echo -e "Running E2E tests...\n"
  time ./environments/$ENV_NAME/start.sh --es "$ELK_VERSION" --kbn "$ELK_VERSION" $OPTIONAL_ECK_ARG $OPTIONAL_ROR_ES_ARG $OPTIONAL_ROR_KBN_ARG $OPTIONAL_DEV_ARG
  time ./e2e-tests/run-tests.sh "$ELK_VERSION" "$ENV_NAME"
else
  time ./environments2/$ENV_NAME/start.sh --es "$ELK_VERSION" --kbn "$ELK_VERSION" $OPTIONAL_ECK_ARG $OPTIONAL_ROR_ES_ARG $OPTIONAL_ROR_KBN_ARG $OPTIONAL_DEV_ARG
  echo -e "Bootstrap mode: Cluster setup completed.\n"
fi