#!/bin/bash -e

cleanup() {
  ./elk-ror/clean.sh 
}

trap cleanup EXIT

time ./elk-ror/run.sh
time ./e2e-tests/run.sh