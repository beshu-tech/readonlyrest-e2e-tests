#!/bin/bash -e

cd "$(dirname "$0")"

echo "Stoppping and cleaning enviroment the tests were being run at ..."

docker-compose rm --stop --force

echo "Done!"