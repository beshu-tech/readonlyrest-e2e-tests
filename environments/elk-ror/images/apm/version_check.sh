#!/bin/bash

# Require exactly 2 arguments
if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <version1> <version2>"
  echo "Checks if version1 is equal to or higher than version2"
  exit 2
fi

# Ensure parameters aren't empty
if [[ -z "$1" || -z "$2" ]]; then
  echo "Error: Version parameters cannot be empty"
  exit 2
fi

is_version_equal_or_higher() {
  [[ "$1" == $(echo -e "$1\n$2" | sort -V | tail -n1) ]]
}

if is_version_equal_or_higher "$1" "$2"; then
  exit 0
else
  exit 1
fi