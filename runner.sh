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

STACK_LOGS=results/stack-logs

# One collector, one output directory, for both failure paths, so the two cannot drift apart.
# --console adds the stack's own log to the job log, which is what a stack that never came up
# explains itself with. It never fails: this runs when something else has already gone wrong.
collect_logs() {
  ./environments/"$ENV_NAME"/collect-logs.sh "$STACK_LOGS" --console || true
}

E2E_OUTPUT=results/e2e-output.log

# Cypress prints its per-spec table thousands of lines into the step log, where nobody finds it.
# Repeat it on the run's summary page, which is the first thing a reader opens. Outside Actions
# GITHUB_STEP_SUMMARY is unset and this does nothing.
write_step_summary() {
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] || return 0
  [ -f "$E2E_OUTPUT" ] || return 0
  {
    echo "### E2E: ELK $ELK_VERSION on $ENV_NAME"
    echo
    echo '```'
    # Strip the colour codes first: they render as literal escapes in Markdown, and Cypress puts
    # some of them between the bracket and the words below, where they would break the match.
    sed -e 's/\x1b\[[0-9;]*m//g' "$E2E_OUTPUT" | sed -n '/Run Finished/,$p'
    echo '```'
  } >> "$GITHUB_STEP_SUMMARY"
}

cleanup() {
  ./environments/"$ENV_NAME"/stop-and-clean.sh
}

trap collect_logs ERR
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

  mkdir -p results

  # Take the status by hand, because errexit would end the script here, before the summary and the
  # logs below. PIPESTATUS holds the suite's status, not tee's.
  set +e
  time ./e2e-tests/run-tests.sh "$ELK_VERSION" "$ENV_NAME" 2>&1 | tee "$E2E_OUTPUT"
  E2E_STATUS=${PIPESTATUS[0]}
  set -e

  write_step_summary

  if [[ $E2E_STATUS -ne 0 ]]; then
    # No --console: the job log already holds the whole Cypress output, and repeating the stack
    # logs under it buries the summary. Into results/, because that is the directory the callers
    # already collect on failure, next to the Cypress videos and screenshots. No caller has to
    # change to start receiving the logs.
    echo -e "\nE2E tests failed - collecting the stack logs\n"
    ./environments/"$ENV_NAME"/collect-logs.sh "$STACK_LOGS" || true
  fi

  exit $E2E_STATUS
else
  echo -e "Bootstrap mode: Cluster setup completed.\n"
fi