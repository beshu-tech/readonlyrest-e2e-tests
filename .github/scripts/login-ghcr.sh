#!/usr/bin/env bash
# Logs the local Docker CLI in to ghcr.io using ROR_GH_TOKEN.
# Retries transient registry failures so a brief GHCR hiccup does not fail a job.

set -euo pipefail

if [ -z "${ROR_GH_TOKEN:-}" ]; then
  echo "ERROR: ROR_GH_TOKEN is not set (required to log in to ghcr.io)." >&2
  exit 1
fi

ATTEMPTS=${GHCR_LOGIN_ATTEMPTS:-3}
DELAY=${GHCR_LOGIN_RETRY_DELAY_SECONDS:-10}

for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  if output=$(printf '%s' "$ROR_GH_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-x-access-token}" --password-stdin 2>&1); then
    exit 0
  fi
  printf '%s\n' "$output" >&2
  if printf '%s' "$output" | grep -qiE 'unauthorized|denied'; then
    echo "ERROR: ghcr.io rejected the credentials; not retrying." >&2
    exit 1
  fi
  if [ "$attempt" -lt "$ATTEMPTS" ]; then
    echo "WARN: ghcr.io login failed (attempt $attempt of $ATTEMPTS). Retrying in ${DELAY}s." >&2
    sleep "$DELAY"
    DELAY=$((DELAY * 2))
  fi
done

echo "ERROR: ghcr.io login failed after $ATTEMPTS attempts." >&2
exit 1
