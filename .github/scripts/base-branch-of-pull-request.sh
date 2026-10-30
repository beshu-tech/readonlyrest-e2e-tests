#!/usr/bin/env bash
# Prints the base branch of the code that a pull request run tests.
#
# The run tests HEAD: the merge commit that GitHub builds from the PR and the tip of its base
# branch. The base_ref of the event can name another branch. When the base of the PR changes a
# few seconds before a push, the event of the push can carry the old base, and GitHub builds the
# merge commit on the new one.
#
# The PR names its base branch and the commit of that branch that GitHub merges onto. When that
# commit is the first parent of HEAD, HEAD is built on the base of the PR. When it is not, the PR
# changed after this event, for example on a re-run after a later change of base, and base_ref
# names the base of HEAD. When the API does not answer, base_ref is the only fact left.
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
# The checkout is shallow, so HEAD^1 does not resolve. The commit object still names its parents.
head_base_commit=$(git cat-file -p HEAD | awk '/^parent / { print $2; exit }')

if [ "$pr_base" != "$base_ref" ] && [ -n "$head_base_commit" ] && [ "$pr_base_commit" = "$head_base_commit" ]; then
  echo ">>> the event names '$base_ref', but HEAD is built on '$pr_base', the base of the PR" >&2
  echo "$pr_base"
else
  echo "$base_ref"
fi
