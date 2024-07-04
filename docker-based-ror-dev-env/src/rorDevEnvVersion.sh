#!/bin/bash -e

cd "$(dirname "$0")"

# we calculate the ROR def env image tag based on the docker-based-ror-dev-env (TBH we could use only Dockerfile 
# and entrypoing scripts, but this solution is good enought for now)
find ../../docker-based-ror-dev-env -type f -exec sha256sum {} + | sha256sum | awk '{print $1}' | cut -c1-10