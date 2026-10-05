#!/bin/bash -e

cd "$(dirname "$0")"

if ! docker version &>/dev/null; then
  echo "No Docker found. Docker is required to run this script."
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo "No docker compose found. Docker compose is required to run this script."
  exit 2
fi

if [[ -z "${ROR_ACTIVATION_KEY}" ]]; then
  echo "ROR_ACTIVATION_KEY env is not set or is empty (see https://github.com/beshu-tech/readonlyrest-e2e-tests/blob/master/README.md#troubleshooting to figure out how to obtain the key and set it)"
  exit 1
fi

show_help() {
  echo "Start Docker Compose-based ELK cluster with ReadonlyREST"
  echo ""
  echo "Options:"
  echo "  --es <version>           Elasticsearch version (required)"
  echo "  --kbn <version>          Kibana version (required)"
  echo "  --cluster-type <type>    Cluster type: 'base' for basic cluster, 'apm' for cluster with APM (default: base)"
  echo "  --ror-es <version>       ReadonlyREST ES version (default: latest)"
  echo "  --ror-kbn <version>      ReadonlyREST Kibana version (default: latest)"
  echo "  --mode <mode>            Image source: 'prod' for release images, 'dev' for development images (default: prod)"
  echo ""
  echo "Examples:"
  echo "  ./start.sh --es 8.11.0 --kbn 8.11.0                    # Start base cluster"
  echo "  ./start.sh --es 8.11.0 --kbn 8.11.0 --cluster-type apm # Start cluster with APM"
  exit 1
}

echo "Preparing environment the tests will be run at ..."

export ES_VERSION=""
export KBN_VERSION=""
export CLUSTER_TYPE="base"
export ROR_ES_VERSION="latest"
export ROR_KBN_VERSION="latest"
export ROR_ES_REPO="beshultd/elasticsearch-readonlyrest"
export ROR_KBN_REPO="beshultd/kibana-readonlyrest"
MODE="prod"

while [[ $# -gt 0 ]]; do
  case $1 in
  --es)
    if [[ -n $2 && $2 != --* ]]; then
      ES_VERSION="$2"
      shift 2
    else
      echo "Error: --es requires a version argument"
      show_help
    fi
    ;;
  --ror-es)
    if [[ -n $2 && $2 != --* ]]; then
      ROR_ES_VERSION="$2"
      shift 2
    else
      echo "Error: --ror-es requires a version argument"
      show_help
    fi
    ;;
  --kbn)
    if [[ -n $2 && $2 != --* ]]; then
      KBN_VERSION="$2"
      shift 2
    else
      echo "Error: --kbn requires a version argument"
      show_help
    fi
    ;;
  --ror-kbn)
    if [[ -n $2 && $2 != --* ]]; then
      ROR_KBN_VERSION="$2"
      shift 2
    else
      echo "Error: --ror-kbn requires a version argument"
      show_help
    fi
    ;;
  --cluster-type)
    if [[ -n $2 && $2 != --* ]]; then
      if [[ "$2" == "base" || "$2" == "apm" ]]; then
        CLUSTER_TYPE="$2"
        shift 2
      else
        echo "Error: --cluster-type must be 'base' or 'apm'"
        show_help
      fi
    else
      echo "Error: --cluster-type requires a value (base or apm)"
      show_help
    fi
    ;;
  --mode)
    if [[ -n $2 && $2 != --* ]]; then
      case "$2" in
        "prod")
          MODE="prod"
          export ROR_ES_REPO="beshultd/elasticsearch-readonlyrest"
          export ROR_KBN_REPO="beshultd/kibana-readonlyrest"
          shift 2
          ;;
        "dev")
          MODE="dev"
          export ROR_ES_REPO="beshultd/elasticsearch-readonlyrest-dev"
          export ROR_KBN_REPO="beshultd/kibana-readonlyrest-dev"
          shift 2
          ;;
        *)
          echo "Error: --mode: Only 'prod' and 'dev' are available modes"
          show_help
          ;;
      esac
    else
      echo "Error: --mode: Only 'prod' and 'dev' are available modes"
      show_help
    fi
    ;;
  --help|-h)
    show_help
    ;;
  *)
    echo "Unknown option: $1"
    show_help
    ;;
  esac
done

if [[ -z $ES_VERSION || -z $KBN_VERSION ]]; then
  echo "Error: Both --es and --kbn arguments are required"
  show_help
fi

ROR_ES_IMAGE="${ROR_ES_REPO}:${ES_VERSION}-ror-${ROR_ES_VERSION}"
ROR_KBN_IMAGE="${ROR_KBN_REPO}:${KBN_VERSION}-ror-${ROR_KBN_VERSION}"

echo "Pre-pulling ES image $ROR_ES_IMAGE ..."
docker pull "$ROR_ES_IMAGE" || { echo "Failed to pull ES image: $ROR_ES_IMAGE"; exit 1; }

echo "Pre-pulling Kibana image $ROR_KBN_IMAGE ..."
docker pull "$ROR_KBN_IMAGE" || { echo "Failed to pull Kibana image: $ROR_KBN_IMAGE"; exit 1; }

echo "Bootstrapping the docker-based environment ..."
echo "Cluster type: $CLUSTER_TYPE"

# Resource limits live in separate *.limits.docker-compose.yml overlays so they're opt-in.
# Disabled by default — safe for Docker-in-Docker on a cgroup v2 host, where a threaded
# /sys/fs/cgroup/docker can't enable the memory controller and a mem_limit would prevent containers
# from starting. Set APPLY_RESOURCE_LIMITS=true to apply them; needed on small host-docker agents to avoid OOM.
#
# Accepts true, false or auto. `auto` applies them only when the host has less than 12 GB RAM.
APPLY_RESOURCE_LIMITS="${APPLY_RESOURCE_LIMITS:-false}"

AUTO_LIMITS_MEM_THRESHOLD_KB=12000000

# Resolves APPLY_RESOURCE_LIMITS=auto to true or false, and records why in
# APPLY_RESOURCE_LIMITS_REASON. Leaves an explicit true/false untouched.
resolve_auto_resource_limits() {
  [[ "$APPLY_RESOURCE_LIMITS" == "auto" ]] || return 0

  local mem_kb
  mem_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"

  # mem_kb is 0 where there is no /proc/meminfo (macOS); treat that as "cannot tell" and leave the
  # limits off, matching the default.
  if [[ "$mem_kb" -gt 0 && "$mem_kb" -lt "$AUTO_LIMITS_MEM_THRESHOLD_KB" ]]; then
    APPLY_RESOURCE_LIMITS="true"
  else
    APPLY_RESOURCE_LIMITS="false"
  fi

  APPLY_RESOURCE_LIMITS_REASON=" (auto: host has ${mem_kb} kB, threshold is ${AUTO_LIMITS_MEM_THRESHOLD_KB} kB)"
}

resolve_auto_resource_limits

# Set compose files based on cluster type
if [[ "$CLUSTER_TYPE" == "base" ]]; then
  DOCKER_COMPOSE_FILES="-f base.docker-compose.yml"
  [[ "$APPLY_RESOURCE_LIMITS" == "true" ]] && DOCKER_COMPOSE_FILES="$DOCKER_COMPOSE_FILES -f base.limits.docker-compose.yml"
  echo "Starting base cluster (Elasticsearch + Kibana + ReadonlyREST)"
elif [[ "$CLUSTER_TYPE" == "apm" ]]; then
  DOCKER_COMPOSE_FILES="-f base.docker-compose.yml -f apm.docker-compose.yml"
  [[ "$APPLY_RESOURCE_LIMITS" == "true" ]] && DOCKER_COMPOSE_FILES="$DOCKER_COMPOSE_FILES -f base.limits.docker-compose.yml -f apm.limits.docker-compose.yml"
  echo "Starting cluster with APM (Elasticsearch + Kibana + ReadonlyREST + APM Server + APM App)"
fi
echo "Resource limits: $([[ "$APPLY_RESOURCE_LIMITS" == "true" ]] && echo "applied" || echo "disabled")${APPLY_RESOURCE_LIMITS_REASON:-}"

if ! docker compose $DOCKER_COMPOSE_FILES config > /dev/null; then
  echo "Cannot validate docker compose configuration."
  exit 3
fi

handle_docker_compose_error() {
  docker compose $DOCKER_COMPOSE_FILES logs 2>&1 | ../common/remove-activation-key.sh > elk-ror.log \
    || echo "No logs: the activation key could not be removed from them." > elk-ror.log
  exit 1
}

# No new `up` starts after this deadline. `--wait` without a timeout blocks forever.
TIMEOUT_IN_SECONDS=600
# ROR KBN 1.71.0 and older can stop Kibana at boot when an Elasticsearch call gets ECONNRESET, so a
# prod start runs `up` again after it. A dev start does not: a restart at boot there is a regression.
# The fix: https://github.com/sscarduzio/readonlyrest_kbn/pull/1075 (first release after 1.71.0).
# Remove the retry: https://github.com/beshu-tech/readonlyrest-e2e-tests/issues/146
if [[ "$MODE" == "dev" ]]; then
  MAX_RESTARTS_PER_CONTAINER="${MAX_RESTARTS_PER_CONTAINER:-0}"
else
  MAX_RESTARTS_PER_CONTAINER="${MAX_RESTARTS_PER_CONTAINER:-3}"
fi
if [[ ! "$MAX_RESTARTS_PER_CONTAINER" =~ ^[0-9]{1,4}$ ]]; then
  echo "Error: MAX_RESTARTS_PER_CONTAINER must be a non-negative integer, got '${MAX_RESTARTS_PER_CONTAINER}'."
  exit 3
fi

# Prints "<container> <RestartCount>" for each container, after no container is restarting any more.
# Docker reports a restarting container as unhealthy, so an `up` started then fails at once.
# Fails when a container is still restarting at the deadline.
restart_counts() {
  local deadline=$1 ids
  ids=$(docker compose $DOCKER_COMPOSE_FILES ps -aq)
  [[ -n "$ids" ]] || return 0
  while (( SECONDS < deadline )) && docker inspect -f '{{.State.Status}}' $ids | grep -qx restarting; do
    sleep 1
  done
  docker inspect -f '{{.Name}} {{.RestartCount}}' $ids | sed 's|^/||'
  ! docker inspect -f '{{.State.Status}}' $ids | grep -qx restarting
}

# Docker resets ExitCode and OOMKilled when it restarts a container. Its events keep the exit of each
# process, so the start records them.
record_exits() {
  exits_file=$(mktemp)
  docker events --filter type=container --filter event=die --filter event=oom \
    --format '{{.Actor.ID}} {{.Action}}{{with index .Actor.Attributes "exitCode"}} exitCode={{.}}{{end}}' \
    > "$exits_file" 2>/dev/null &
  exits_pid=$!
  # errexit applies in the trap too: a failed kill would turn a ready environment into exit 1.
  trap 'kill "$exits_pid" 2>/dev/null || true; rm -f "$exits_file"' EXIT
}

# The crash message of ROR KBN 1.71.0 comes about 50 lines before the restart.
RESTART_LOG_LINES=100
shown_restarts=""

# For each container that restarted since the last call: its state, its exits, and the last log lines
# before its latest restart. The CI logs are public, so this removes the activation key from the logs.
show_restarts() {
  local name count id started status before
  while read -r name count; do
    [[ -n "$name" ]] && (( count > 0 )) || continue
    grep -qxF "$name $count" <<< "$shown_restarts" && continue
    shown_restarts+="$name $count"$'\n'
    read -r id started status <<< "$(docker inspect -f '{{.Id}} {{.State.StartedAt}} {{.State.Status}}' "$name")"
    # The output of a running process starts at StartedAt. A container that is not running shows
    # its last exit at the end of its log.
    before=()
    [[ "$status" == running ]] && before=(--until "$started")
    echo "::group::$name restarted $count time(s) during the start"
    docker inspect -f 'State now: Status={{.State.Status}} ExitCode={{.State.ExitCode}} OOMKilled={{.State.OOMKilled}} RestartCount={{.RestartCount}} StartedAt={{.State.StartedAt}} FinishedAt={{.State.FinishedAt}}' "$name"
    awk -v id="$id" '$1 == id { $1 = ""; e = e (e ? "," : "") $0 }
      END { print "Exits during the start:" (e ? e : " none recorded") }' "$exits_file"
    echo "The last $RESTART_LOG_LINES log lines before the latest restart:"
    docker logs --timestamps "${before[@]}" "$name" 2>&1 | tail -n "$RESTART_LOG_LINES" \
      | ../common/remove-activation-key.sh || echo "The logs are not shown: the activation key could not be removed from them."
    echo "::endgroup::"
  done <<< "$1"
}

within_restart_limit() {
  local counts=$1 most
  most=$(awk '$2 > m { m = $2 } END { print m + 0 }' <<< "$counts")
  if (( most > MAX_RESTARTS_PER_CONTAINER )); then
    echo "A container restarted more than ${MAX_RESTARTS_PER_CONTAINER} time(s) during the start:"
    echo "$counts"
    return 1
  fi
}

# `up` fails when a container exits during its health wait, also when `restart: always` brings it
# back, and dropping `--wait` does not help. So `up` runs again while each failure comes with a new restart.
compose_up_tolerating_restarts() {
  local deadline=$((SECONDS + TIMEOUT_IN_SECONDS)) remaining restarts_before=0 restarts counts settled
  local up_args=(--force-recreate)
  while true; do
    remaining=$((deadline - SECONDS))
    if (( remaining <= 0 )); then
      echo "The environment is not ready after ${TIMEOUT_IN_SECONDS}s."
      return 1
    fi
    if docker compose $DOCKER_COMPOSE_FILES up -d --no-build --remove-orphans "${up_args[@]}" --wait --wait-timeout "$remaining"; then
      # Also counts a restart that `up` did not see. Any restart here is a crash at boot.
      counts=$(restart_counts "$deadline")
      settled=$?
      show_restarts "$counts"
      if (( settled != 0 )); then
        echo "A container is still restarting after ${TIMEOUT_IN_SECONDS}s:"
        echo "$counts"
        return 1
      fi
      within_restart_limit "$counts" || return 1
      awk '$2 > 0 { printf "::warning title=Container restarted at boot::%s restarted %d time(s) during the start\n", $1, $2 }' <<< "$counts"
      return 0
    fi
    # A container still restarting at the deadline ends the loop at its next pass.
    counts=$(restart_counts "$deadline") || true
    show_restarts "$counts"
    restarts=$(awk '{ s += $2 } END { print s + 0 }' <<< "$counts")
    if (( restarts == restarts_before )); then
      echo "The start failed without a new container restart."
      return 1
    fi
    within_restart_limit "$counts" || return 1
    echo "A container restarted during the start. Waiting for the environment again ..."
    restarts_before=$restarts
    up_args=()
  done
}

docker compose $DOCKER_COMPOSE_FILES build || handle_docker_compose_error
record_exits
compose_up_tolerating_restarts || handle_docker_compose_error

echo "The environment is ready"
