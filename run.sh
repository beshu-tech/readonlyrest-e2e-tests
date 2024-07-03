#!/bin/bash -e

cleanup() {
  ./elk-ror/clean.sh 
}

trap cleanup EXIT

./elk-ror/run.sh
./e2e-tests/run.sh