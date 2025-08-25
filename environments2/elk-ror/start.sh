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
  echo "Usage: ./run.sh --es <elasticsearch_version> --kbn <kibana_version>  [--ror-es <ror_es_version> (default: latest) --ror-kbn <ror_kbn_version> (default: latest) --dev (use dev images)]"
  exit 1
}

echo "Preparing environment the tests will be run at ..."

export ES_VERSION=""
export KBN_VERSION=""
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
  --dev)
    export ROR_ES_REPO="beshultd/elasticsearch-readonlyrest-dev"
    export ROR_KBN_REPO="beshultd/kibana-readonlyrest-dev"
    shift
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

echo "Bootstrapping the docker-based environment ..."

if ! docker compose config > /dev/null; then
  echo "Cannot validate docker compose configuration."
  exit 3
fi

docker compose up -d --build --remove-orphans --force-recreate --wait
docker compose logs -f > elk-ror.log 2>&1 &

echo "The environment ready"