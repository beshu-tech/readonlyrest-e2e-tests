#!/bin/bash
# Points the Docker Hub pulls of a CI job at a pull-through cache.
#
# HOW TO USE IT
# Source the script. Do not run it. The caller shell needs the variable that the script exports.
#
#   source .github/scripts/docker-hub-mirror.sh
#
# WHY
# Docker Hub rejects a pull with a bare `429 Too Many Requests` when the runner's address is over
# the abuse rate limit. Docker applies that limit per address and ignores the account, so a login
# does not prevent it. A CI runner shares its address with other tenants, and a neighbour can fill
# the bucket.
#
# mirror.gcr.io answers from a different host, which removes that pressure. It serves docker.io
# only. It cannot serve docker.elastic.co or registry.access.redhat.com, and it cannot accept a
# push.
#
# WHAT READS THE SETTING
# ROR_DOCKER_HUB_MIRROR_PREFIX carries it. Each place that pulls a Docker Hub image puts the prefix
# in front of the name, and the prefix is empty when the mirror is off:
#   - environments/common/images/node-apm-app/Dockerfile  the MIRROR build argument
#   - environments/elk-ror/images/kbn/Proxy-Dockerfile    the MIRROR build argument
#   - environments/eck-ror/start.sh                       the busybox pull
#
# A prefixed name is a different image identity, so these pulls do not fall back to Docker Hub.
# Name only an image the mirror serves. `library/` is the namespace of an official image, so
# `library/nginx:latest` and `nginx:latest` name the same image and resolve to the same digest.
#
# The ROR ES and ROR KBN images keep their Docker Hub name. A dev run pulls them minutes after the
# other repo pushed them, and a cache can hold a stale answer.
#
# The Kind node image also keeps its Docker Hub name. Kind chooses that name itself, one for each
# Kind version. This script cannot change it.
#
# ROR_DOCKER_HUB_MIRROR=false switches the mirror off.

ROR_DOCKER_HUB_MIRROR_HOST="mirror.gcr.io"

# Always returns 0. A mirror is an optimisation, and it must never stop a job.
_ror_docker_hub_mirror() {
  if [ "$(echo "${ROR_DOCKER_HUB_MIRROR:-true}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')" = "false" ]; then
    unset ROR_DOCKER_HUB_MIRROR_PREFIX

    if [ -n "${GITHUB_ACTIONS:-}" ]; then
      echo "ROR_DOCKER_HUB_MIRROR_PREFIX=" >> "$GITHUB_ENV"
    fi

    echo "[CI] Docker Hub mirror is OFF."
    return 0
  fi

  export ROR_DOCKER_HUB_MIRROR_PREFIX="${ROR_DOCKER_HUB_MIRROR_HOST}/"

  # A step is its own process, so give the value to the later steps of the job as well.
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "ROR_DOCKER_HUB_MIRROR_PREFIX=${ROR_DOCKER_HUB_MIRROR_HOST}/" >> "$GITHUB_ENV"
  fi

  echo "[CI] Docker Hub mirror is ON: ${ROR_DOCKER_HUB_MIRROR_HOST}."
  return 0
}

_ror_docker_hub_mirror

# `unset` gives this file the status 0, so a caller with `set -e` goes on.
unset -f _ror_docker_hub_mirror
