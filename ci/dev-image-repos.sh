# shellcheck shell=bash
# Sourced, not executed. Names the Docker repositories of the ROR dev images.
# An unset or empty variable takes the default, which is Docker Hub.
ROR_ES_DEV_IMAGE_REPO="${ROR_ES_DEV_IMAGE_REPO:-beshultd/elasticsearch-readonlyrest-dev}"
ROR_KBN_DEV_IMAGE_REPO="${ROR_KBN_DEV_IMAGE_REPO:-beshultd/kibana-readonlyrest-dev}"
