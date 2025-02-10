#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

df -h

kind delete cluster --name ror-eck
