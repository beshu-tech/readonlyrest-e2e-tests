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
E2E_OUTPUT=results/e2e-output.log
E2E_SUMMARY=results/e2e-summary.md

# Runs from the ERR trap, where the stack did not come up. --console puts the stack log on the
# console, because the job log has no other record of the failure.
collect_logs() {
  collect_stack_logs --console
}

# The per-spec table and the totals that Cypress prints at the end of its output, as Markdown.
write_summary() {
  [ -f "$E2E_OUTPUT" ] || return 0
  {
    echo "### E2E: ELK $ELK_VERSION on $ENV_NAME"
    echo
    echo '```'
    # Strip the colour codes first: Markdown shows them as literal escapes, and Cypress puts some
    # between the bracket and "Run Finished", where they would break the match.
    sed -e 's/\x1b\[[0-9;]*m//g' "$E2E_OUTPUT" | sed -n '/Run Finished/,$p'
    echo '```'
  } > "$E2E_SUMMARY"
}

cleanup() {
  # Set only while the suite runs: here the script ends with a signal or an error mid-suite.
  [ -n "$WATCHDOG_PGID" ] && { kill -- "-$WATCHDOG_PGID" 2>/dev/null || true; }
  [ -n "$SUITE_PGID" ] && { kill -TERM -- "-$SUITE_PGID" 2>/dev/null || true; }
  # Also on a timeout or a cancel: the retry wrapper and GitHub end this script with a signal, and the
  # teardown below deletes the containers with their logs.
  [ "$RUN_PASSED" = true ] || collect_stack_logs
  ./environments/"$ENV_NAME"/stop-and-clean.sh
}

# A new directory for each run of this script: the retry wrapper runs it again in the same checkout,
# and the next attempt must not overwrite the logs of the attempt that failed. No ":" in the name,
# because the artifact upload rejects it.
ATTEMPT_LOGS=$STACK_LOGS/attempt-$(date -u +%Y%m%dT%H%M%SZ)
RUN_PASSED=false
SUITE_STARTED=false
STACK_LOGS_COLLECTED=false
SUITE_PGID=
WATCHDOG_PGID=

collect_stack_logs() {
  [ "$STACK_LOGS_COLLECTED" = true ] && return 0
  STACK_LOGS_COLLECTED=true
  ./environments/"$ENV_NAME"/collect-logs.sh "$ATTEMPT_LOGS" "$@" || true
  # The output file of an earlier attempt is still there when this attempt did not reach the suite.
  [ "$SUITE_STARTED" = true ] && cp "$E2E_OUTPUT" "$ATTEMPT_LOGS/" 2>/dev/null
  return 0
}

# A Kibana replica that hangs does not recover, and every later test fails on it after 20 s, three
# times. Without this stop, the attempt runs into the cap of the retry wrapper. One spec restarts
# Kibana on purpose. The window is longer than that restart, so only a replica that stays down stops
# the suite.
KIBANA_PROBE_INTERVAL=30
KIBANA_DOWN_LIMIT=420

watch_kibana() {
  local down_since=
  while sleep "$KIBANA_PROBE_INTERVAL"; do
    if ./environments/"$ENV_NAME"/probe-kibana.sh > results/kibana-watchdog.txt 2>&1; then
      down_since=
      continue
    fi
    down_since=${down_since:-$SECONDS}
    if (( SECONDS - down_since >= KIBANA_DOWN_LIMIT )); then
      echo -e "\nERROR: a Kibana replica does not answer for ${KIBANA_DOWN_LIMIT}s. The suite stops.\n"
      cat results/kibana-watchdog.txt
      kill -TERM -- "-$SUITE_PGID"
      return
    fi
  done
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

  # The stack is healthy by its own checks, which ask Kibana core only. This asks each replica for a
  # request that goes through ROR KBN, and stops here when one does not answer.
  if ! ./environments/"$ENV_NAME"/probe-kibana.sh --wait 120; then
    echo -e "\nERROR: a Kibana replica does not answer after the start. The suite does not run.\n"
    exit 1
  fi

  # errexit would end the script here, before the summary and the logs.
  set +e
  SUITE_STARTED=true
  # Job control puts each background job in its own process group, so one kill stops the whole
  # suite: yarn, Cypress and its browser. The subshell exits with the suite's status, not tee's.
  set -m
  ( ./e2e-tests/run-tests.sh "$ELK_VERSION" "$ENV_NAME" 2>&1 | tee "$E2E_OUTPUT"; exit "${PIPESTATUS[0]}" ) &
  SUITE_PGID=$!
  watch_kibana &
  WATCHDOG_PGID=$!
  set +m
  # The `||` keeps a failed suite from firing the ERR trap, which is for a stack that did not start.
  E2E_STATUS=0
  time wait "$SUITE_PGID" || E2E_STATUS=$?
  SUITE_PGID=
  # The watchdog is gone when it stopped the suite itself.
  kill -- "-$WATCHDOG_PGID" 2>/dev/null || true
  WATCHDOG_PGID=
  set -e

  write_summary

  if [[ $E2E_STATUS -ne 0 ]]; then
    # The EXIT trap collects them. No --console: the Cypress output is on the console, and the stack
    # logs under it would bury the summary.
    echo -e "\nE2E tests failed - collecting the stack logs\n"
  else
    RUN_PASSED=true
  fi

  exit $E2E_STATUS
else
  RUN_PASSED=true
  echo -e "Bootstrap mode: Cluster setup completed.\n"
fi