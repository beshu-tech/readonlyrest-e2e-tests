#!/bin/bash -e

cd "$(dirname "$0")"

./runInDocker.sh e2e-tests-8x
