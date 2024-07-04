#!/bin/bash -e

cd "$(dirname "$0")"

echo "Cleaning up docker stuff ..."

IMAGE_IDS_TO_REMOVE=$(docker images --filter "reference=ror-kbn-dev-env" --format "{{.CreatedAt}} {{.ID}}" | sort | grep -vE "^$(date +%Y)-$(date +%m)" | awk '{print $NF}')

while IFS= read -r image_id; do
  if [[ $image_id == '' ]]; then
    continue
  fi

  IMAGE_AND_TAG=$(docker inspect --format='{{.RepoTags}}' "$image_id" | sed -E 's/^\[?(.*):(.*)\]$/\1:\2/')
  echo "Cleaning up things related to $IMAGE_AND_TAG ..."

  ROR_DEV_IMAGE_CONTAINER_IDS=$(docker ps -a --filter "ancestor=${IMAGE_AND_TAG}" --format "{{.ID}}")
  if [ -n "$ROR_DEV_IMAGE_CONTAINER_IDS" ]; then
    echo "Stopping and removing containers which use the image ${IMAGE_AND_TAG}:"
    for container_id in $ROR_DEV_IMAGE_CONTAINER_IDS; do
      docker stop "$container_id" 
      docker rm --volumes "$container_id"
    done
  else
    echo "No containers found for image ${IMAGE_AND_TAG}."
  fi

  docker rmi --force "$IMAGE_AND_TAG"
done <<< "$IMAGE_IDS_TO_REMOVE"

echo "Cleaning complete!"