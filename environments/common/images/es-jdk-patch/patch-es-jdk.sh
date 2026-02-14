#!/bin/sh
# ES 7.16.x-7.17.6 and 8.0.x-8.4.x bundle JDK 17.0.1/17.0.2 or JDK 18, which have cgroup v2
# bug JDK-8287073: CgroupV2Subsystem.getInstance() NPEs before UseContainerSupport is checked.
# Fixed in JDK 17.0.5+ (backport JDK-8288308) and JDK 19+.
# We replace the bundled JDK: Corretto 17.0.5 for JDK-17 builds, Corretto 19.0.0 for JDK-18 builds.
#
# Usage:
#   ES_VERSION=7.16.0 ./patch-es-jdk.sh          # patch the JDK in /usr/share/elasticsearch/jdk
#   ES_VERSION=7.16.0 ./patch-es-jdk.sh --check   # exit 0 if patching is needed, 1 otherwise
set -e

MAJOR=$(echo "$ES_VERSION" | cut -d. -f1)
MINOR=$(echo "$ES_VERSION" | cut -d. -f2)
PATCH=$(echo "$ES_VERSION" | cut -d. -f3)

CORRETTO_VERSION=""
if [ "$MAJOR" -eq 7 ] && [ "$MINOR" -eq 16 ]; then
  CORRETTO_VERSION="17.0.5.8.1"
elif [ "$MAJOR" -eq 7 ] && [ "$MINOR" -eq 17 ] && [ "$PATCH" -le 2 ]; then
  CORRETTO_VERSION="17.0.5.8.1"
elif [ "$MAJOR" -eq 7 ] && [ "$MINOR" -eq 17 ] && [ "$PATCH" -le 6 ]; then
  CORRETTO_VERSION="19.0.0.36.1"
elif [ "$MAJOR" -eq 8 ] && [ "$MINOR" -le 1 ]; then
  CORRETTO_VERSION="17.0.5.8.1"
elif [ "$MAJOR" -eq 8 ] && [ "$MINOR" -le 4 ]; then
  CORRETTO_VERSION="19.0.0.36.1"
fi

if [ "$1" = "--check" ]; then
  [ -n "$CORRETTO_VERSION" ]
  exit $?
fi

if [ -n "$CORRETTO_VERSION" ]; then
  ARCH=$(uname -m | sed 's/x86_64/x64/' | sed 's/arm64/aarch64/')
  echo "Replacing buggy bundled JDK with Corretto $CORRETTO_VERSION for ES $ES_VERSION (arch: $ARCH)"
  curl -fsSLk "https://corretto.aws/downloads/resources/${CORRETTO_VERSION}/amazon-corretto-${CORRETTO_VERSION}-linux-${ARCH}.tar.gz" -o /tmp/jdk.tar.gz
  rm -rf /usr/share/elasticsearch/jdk
  mkdir -p /usr/share/elasticsearch/jdk
  tar xzf /tmp/jdk.tar.gz -C /usr/share/elasticsearch/jdk --strip-components=1
  rm /tmp/jdk.tar.gz
fi
