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
  echo "ROR_ACTIVATION_KEY is not set or is empty"
  exit 1
fi

show_help() {
  echo "Usage: ./run.sh --es <elasticsearch_version> --kbn <kibana_version>"
  exit 1
}

echo "Preparing environment the tests will be run at ..."

export ES_VERSION=""
export KBN_VERSION=""

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
  --kbn)
    if [[ -n $2 && $2 != --* ]]; then
      KBN_VERSION="$2"
      shift 2
    else
      echo "Error: --kbn requires a version argument"
      show_help
    fi
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

echo "Downloading ROR ES plugin ..."
export ES_ROR_FILE
ES_ROR_FILE=$(./download-ror-es.sh "$ES_VERSION")

echo "Downloading ROR KBN plugin ..."
export KBN_ROR_FILE
KBN_ROR_FILE=$(./download-ror-kbn.sh "$KBN_VERSION")

echo "Bootstrapping the docker-based environment ..."

if ! docker compose config > /dev/null; then
  echo "Cannot validate docker compose configuration."
  exit 3
fi

docker compose up -d --build --remove-orphans --force-recreate --wait
docker compose logs -f > elk-ror.log 2>&1 &

echo "The environment ready"