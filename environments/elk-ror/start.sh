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
  echo "  --dev                    Use development images"
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
  --dev)
    export ROR_ES_REPO="beshultd/elasticsearch-readonlyrest-dev"
    export ROR_KBN_REPO="beshultd/kibana-readonlyrest-dev"
    shift
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

echo "Building JDK-patched ES base image ..."
export ES_PATCHED_IMAGE="es-ror-patched:${ES_VERSION}"
docker build \
  --build-arg BASE_IMAGE="${ROR_ES_REPO}:${ES_VERSION}-ror-${ROR_ES_VERSION}" \
  --build-arg ES_VERSION="$ES_VERSION" \
  -t "$ES_PATCHED_IMAGE" \
  ../common/images/es-jdk-patch/

echo "Bootstrapping the docker-based environment ..."
echo "Cluster type: $CLUSTER_TYPE"

# Set compose files based on cluster type
if [[ "$CLUSTER_TYPE" == "base" ]]; then
  DOCKER_COMPOSE_FILES="-f base.docker-compose.yml"
  echo "Starting base cluster (Elasticsearch + Kibana + ReadonlyREST)"
elif [[ "$CLUSTER_TYPE" == "apm" ]]; then
  DOCKER_COMPOSE_FILES="-f base.docker-compose.yml -f apm.docker-compose.yml"
  echo "Starting cluster with APM (Elasticsearch + Kibana + ReadonlyREST + APM Server + APM App)"
fi

if ! docker compose $DOCKER_COMPOSE_FILES config > /dev/null; then
  echo "Cannot validate docker compose configuration."
  exit 3
fi

handle_docker_compose_error() {
  docker compose $DOCKER_COMPOSE_FILES logs > elk-ror.log 2>&1
  exit 1
}

trap 'handle_docker_compose_error' ERR

docker compose $DOCKER_COMPOSE_FILES up -d --build --remove-orphans --force-recreate --wait

echo "The environment is ready"