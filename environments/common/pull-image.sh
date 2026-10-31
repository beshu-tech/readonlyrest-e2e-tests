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

# pull_docker_hub_images <image>...
# Pulls Docker Hub images named with no registry and by digest: `library/nginx:1.31@sha256:...`.
# It tries the prefixes of ROR_DOCKER_HUB_MIRRORS in order, then Docker Hub, and exports the first
# prefix that gives all the images as ROR_DOCKER_HUB_MIRROR_PREFIX. A build that puts this prefix in
# front of the name finds the image on this machine, and does not go to a registry.
# Each source gives the same content for a digest, so a fallback cannot change the image.
pull_docker_hub_images() {
  local prefixes prefix image
  read -ra prefixes <<< "${ROR_DOCKER_HUB_MIRRORS:-}"
  for prefix in "${prefixes[@]}" ""; do
    for image in "$@"; do
      pull_image "$prefix$image" || continue 2
    done
    export ROR_DOCKER_HUB_MIRROR_PREFIX="$prefix"
    echo "Docker Hub images come from ${prefix:-Docker Hub}."
    return 0
  done
  return 1
}

# docker_hub_image <Dockerfile>
# Prints the image of the `FROM ${MIRROR}...` line, the form that pull_docker_hub_images takes.
docker_hub_image() {
  # shellcheck disable=SC2016 # ${MIRROR} is Dockerfile text, not a shell variable.
  sed -n 's/^FROM \${MIRROR}//p' "$1"
}
