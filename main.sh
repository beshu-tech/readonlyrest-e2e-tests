#!/bin/bash -e

show_help() {
  echo "E2E Test Runner"
  echo ""
  echo "Options:"
  echo "  --mode <mode>            Run mode: 'e2e' for running tests, 'bootstrap' for environment setup only (default: e2e)"
  echo "  --env <environment>      Environment type: 'docker' for Docker Compose, 'eck-x.y.z' for ECK with version (required)"
  echo "  --elk <version>          ELK stack version (required)"
  echo "  --ror-es <version>       ReadonlyREST ES version (default: latest)"
  echo "  --ror-kbn <version>      ReadonlyREST Kibana version (default: latest)"
  echo "  --dev                    Use development images"
  echo ""
  echo "Examples:"
  echo "  ./main.sh --env docker --elk 8.11.0                    # Run E2E tests with Docker Compose"
  echo "  ./main.sh --mode bootstrap --env eck-2.15.0 --elk 8.11.0 # Bootstrap ECK environment only"
  exit 1
}

ENV_NAME=""
ELK_VERSION="$1"
OPTIONAL_ECK_ARG=""
OPTIONAL_ROR_ES_ARG=""
OPTIONAL_ROR_KBN_ARG=""
OPTIONAL_DEV_ARG=""
CLUSTER_TYPE="apm"

while [[ $# -gt 0 ]]; do
  case $1 in
  --mode)
    if [[ -n $2 && $2 != --* ]]; then
      case "$2" in
        "e2e")
          CLUSTER_TYPE="apm"
          ;;
        "bootstrap")
          CLUSTER_TYPE="base"
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

time ./environments/$ENV_NAME/start.sh --cluster-type "$CLUSTER_TYPE" --es "$ELK_VERSION" --kbn "$ELK_VERSION" $OPTIONAL_ECK_ARG $OPTIONAL_ROR_ES_ARG $OPTIONAL_ROR_KBN_ARG $OPTIONAL_DEV_ARG

if [[ "$CLUSTER_TYPE" == "e2e" ]]; then
  echo -e "Running E2E tests...\n"
  time ./e2e-tests/run-tests.sh "$ELK_VERSION" "$ENV_NAME"
else
  echo -e "Bootstrap mode: Cluster setup completed.\n"
fi