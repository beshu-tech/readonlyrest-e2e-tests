#!/bin/bash
# Points the Docker Hub pulls of a CI job at pull-through caches.
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
# A mirror answers from a different host, which removes that pressure. A mirror can also fail to
# serve an image, so the list has more than one, and Docker Hub comes after them. The mirrors serve
# docker.io only. They cannot serve docker.elastic.co or registry.access.redhat.com, and they cannot
# accept a push.
#
# WHAT READS THE SETTING
# ROR_DOCKER_HUB_MIRRORS carries the mirror prefixes, in the order to try them. Its reader is
# pull_docker_hub_images, which the environment start scripts call before the build.
#
# Add only a mirror that serves the official images (`library/`) under the Docker Hub digests.
#
# The ROR ES and ROR KBN images keep their Docker Hub name. A dev run pulls them minutes after the
# other repo pushed them, and a cache can hold a stale answer.
#
# The Kind node image also keeps its Docker Hub name. It is pinned by digest, together with the Kind
# release that built it, and Kind retries its pull.
#
# ROR_DOCKER_HUB_MIRROR=false switches the mirrors off.

ROR_DOCKER_HUB_MIRROR_PREFIXES="mirror.gcr.io/ public.ecr.aws/docker/"

# Always returns 0. A mirror is an optimisation, and it must never stop a job.
_ror_docker_hub_mirror() {
  if [ "$(echo "${ROR_DOCKER_HUB_MIRROR:-true}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')" = "false" ]; then
    unset ROR_DOCKER_HUB_MIRRORS

    if [ -n "${GITHUB_ACTIONS:-}" ]; then
      echo "ROR_DOCKER_HUB_MIRRORS=" >> "$GITHUB_ENV"
    fi

    echo "[CI] Docker Hub mirrors are OFF."
    return 0
  fi

  export ROR_DOCKER_HUB_MIRRORS="$ROR_DOCKER_HUB_MIRROR_PREFIXES"

  # A step is its own process, so give the value to the later steps of the job as well.
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "ROR_DOCKER_HUB_MIRRORS=$ROR_DOCKER_HUB_MIRROR_PREFIXES" >> "$GITHUB_ENV"
  fi

  echo "[CI] Docker Hub mirrors are ON: $ROR_DOCKER_HUB_MIRROR_PREFIXES"
  return 0
}

_ror_docker_hub_mirror

# `unset` gives this file the status 0, so a caller with `set -e` goes on.
unset -f _ror_docker_hub_mirror
