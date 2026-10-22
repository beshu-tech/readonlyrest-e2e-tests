# shellcheck shell=bash
# Sourced, not executed, after retry.sh.
#
# pull_image <image>
# Pulls the image, with retries. When the pull fails, an image of that name on this machine is used:
# a ROR image built on a developer machine is not in a registry.
pull_image() {
  retry 3 docker pull "$1" && return 0
  if docker image inspect "$1" >/dev/null 2>&1; then
    echo "The pull failed. Using the local image $1." >&2
    return 0
  fi
  return 1
}
