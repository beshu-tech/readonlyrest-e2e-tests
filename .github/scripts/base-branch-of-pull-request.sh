#!/usr/bin/env bash
# Prints the branch that HEAD, the merge commit of a pull request run, is built on.
# base_ref of the event can name the old base, when the base of the PR changes just before a push.
# The base that the PR names now can be newer than HEAD, on a re-run. So the base of the PR counts
# only when the PR merges onto the first parent of HEAD. When the PR cannot be read, base_ref stays.
#
# Usage: GH_TOKEN=<token> GITHUB_REPOSITORY=<owner/repo> base-branch-of-pull-request.sh <base_ref> <PR number>
set -uo pipefail

base_ref=${1:?Usage: $0 <github.base_ref> <PR number>}
pr=${2:?Usage: $0 <github.base_ref> <PR number>}

api_url="${GITHUB_API_URL:-https://api.github.com}/repos/${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}/pulls/$pr"
if ! pr_json=$(curl -sSf --max-time 30 --retry 2 -H "Authorization: Bearer ${GH_TOKEN:?GH_TOKEN is not set}" \
  -H 'Accept: application/vnd.github+json' "$api_url") || ! pr_base=$(jq -er .base.ref <<<"$pr_json"); then
  echo ">>> cannot read PR #$pr — the base branch is '$base_ref'" >&2
  echo "$base_ref"
  exit 0
fi
pr_base_commit=$(jq -r '.base.sha // ""' <<<"$pr_json")
# In a shallow checkout HEAD^1 does not resolve, but the commit object still names its parents.
head_base_commit=$(git cat-file -p HEAD | awk '/^parent / { print $2; exit }')

if [ "$pr_base" != "$base_ref" ] && [ -n "$head_base_commit" ] && [ "$pr_base_commit" = "$head_base_commit" ]; then
  echo ">>> the event names '$base_ref', but HEAD is built on '$pr_base', the base of the PR" >&2
  echo "$pr_base"
else
  echo "$base_ref"
fi
