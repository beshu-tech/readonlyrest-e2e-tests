#!/bin/bash -e

show_help() {
  echo "E2E Test Runner"
  echo ""
  echo "Options:"
  echo "  --run <run>              What to run: 'e2e' for running tests, 'bootstrap' for environment setup only (default: e2e)"
  echo "  --mode <mode>            Image source: 'prod' or 'dev' (default: prod)"
  echo "  --env <environment>      Environment type: 'docker' for Docker Compose, 'eck-x.y.z' for ECK with version (required)"
  echo "  --elk <version>          ELK stack version (required)"
  echo "  --ror-es <version>       ReadonlyREST ES version (default: latest)"
  echo "  --ror-kbn <version>      ReadonlyREST Kibana version (default: latest)"
  echo ""
  echo "Examples:"
  echo "  ./runner.sh --env docker --elk 8.11.0                      # Run E2E tests with Docker Compose"
  echo "  ./runner.sh --run bootstrap --env eck-2.15.0 --elk 8.11.0  # Bootstrap ECK environment only"
  exit 1
}

ENV_NAME=""
ELK_VERSION="$1"
OPTIONAL_ECK_ARG=""
OPTIONAL_ROR_ES_ARG=""
OPTIONAL_ROR_KBN_ARG=""
OPTIONAL_MODE_ARG=""
MODE="e2e"
CLUSTER_TYPE="apm"

while [[ $# -gt 0 ]]; do
  case $1 in
  --run)
    if [[ -n $2 && $2 != --* ]]; then
      case "$2" in
        "e2e")
          MODE="e2e"
          CLUSTER_TYPE="apm"
          ;;
        "bootstrap")
          MODE="bootstrap"
          CLUSTER_TYPE="base"
          ;;
        *)
          echo "Error: --run: Only 'e2e' and 'bootstrap' are supported"
          show_help
          ;;
      esac
      shift 2
    else
      echo "Error: --run requires an argument (e2e or bootstrap)"
      show_help
    fi
    ;;
  --mode)
    if [[ -n $2 && $2 != --* ]]; then
      case "$2" in
        "prod"|"dev")
          OPTIONAL_MODE_ARG="--mode $2"
          ;;
        *)
          echo "Error: --mode: Only 'prod' and 'dev' are supported"
          show_help
          ;;
      esac
      shift 2
    else
      echo "Error: --mode requires an argument (prod or dev)"
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

time ./environments/$ENV_NAME/start.sh --cluster-type "$CLUSTER_TYPE" --es "$ELK_VERSION" --kbn "$ELK_VERSION" $OPTIONAL_ECK_ARG $OPTIONAL_ROR_ES_ARG $OPTIONAL_ROR_KBN_ARG $OPTIONAL_MODE_ARG

if [[ "$MODE" == "e2e" ]]; then
  echo -e "Running E2E tests...\n"
  # DIAGNOSTIC (temporary, this PR only): the kbn-ror containers restart mid-suite with exit code 0
  # on the red legs and never on the green ones. The EXIT trap tears the stack down, so the only
  # moment to ask docker who stopped them, and what Kibana logged before it went, is right here.
  SUITE_START=$(date +%s)
  set +e
  time ./e2e-tests/run-tests.sh "$ELK_VERSION" "$ENV_NAME"
  E2E_STATUS=$?
  set -e
  if [[ $E2E_STATUS -ne 0 ]]; then
    echo "=== DIAG: container events since the suite started ==="
    docker events --since "$SUITE_START" --until "$(date +%s)" --filter type=container \
      --format '{{.Time}} {{.Actor.Attributes.name}} {{.Action}} exit={{index .Actor.Attributes "exitCode"}} signal={{index .Actor.Attributes "signal"}}' || true
    for c in $(docker ps -a --filter 'name=^elk-ror-kbn' --format '{{.Names}}'); do
      echo "=== DIAG: $c — last lines around shutdowns and listens ==="
      docker logs --tail 600 "$c" 2>&1 | grep -inE 'sigint|sigterm|shutdown|shutting|stopping|fatal|heap|out of memory|listening|http server running|server running|EADDRINUSE|closed|deleteAllSessions|license|edition|config refresh|restart|unhandled|uncaught' | tail -100 || true
    done
  fi
  exit $E2E_STATUS
else
  echo -e "Bootstrap mode: Cluster setup completed.\n"
fi