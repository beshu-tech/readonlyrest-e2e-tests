#!/bin/bash -e

cd "$(dirname "$0")"

/usr/local/bin/start-docker.sh
/usr/local/bin/processRorEnvCommand.sh "$@"