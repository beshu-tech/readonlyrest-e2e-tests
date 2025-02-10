#!/bin/bash -e

cd "$(dirname "$0")"

df -h

echo "Stopping and cleaning environment the tests were being run at ..."

docker compose rm --stop --force

echo "Done!"