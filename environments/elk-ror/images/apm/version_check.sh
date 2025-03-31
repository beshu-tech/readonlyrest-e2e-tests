#!/bin/bash
set -x
is_version_equal_or_higher() {
  [[ "$1" == $(echo -e "$1\n$2" | sort -V | tail -n1) ]]
}

if is_version_equal_or_higher "$1" "$2"; then
  exit 0
else
  exit 1
fi