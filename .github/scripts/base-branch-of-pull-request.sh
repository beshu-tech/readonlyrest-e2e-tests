#!/usr/bin/env bash
# Prints the branch that HEAD, the merge commit of a pull request run, is built on: the base that
# the PR had at the time GitHub built HEAD. base_ref of the event is not enough. It can name the old
# base, when the base of the PR changes just before a push. The base that the PR names now is not
# enough either: a re-run tests an old HEAD, from before a later change of base. The base changes
# of the PR, with their times, give the answer for both. When the PR cannot be read, base_ref stays.
#
# Usage: GH_TOKEN=<token> GITHUB_REPOSITORY=<owner/repo> base-branch-of-pull-request.sh <base_ref> <PR number>
set -uo pipefail

base_ref=${1:?Usage: $0 <github.base_ref> <PR number>}
pr=${2:?Usage: $0 <github.base_ref> <PR number>}
repository=${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}

# shellcheck disable=SC2016 # GraphQL variables, not shell ones
query='query($owner: String!, $name: String!, $pr: Int!) {
  repository(owner: $owner, name: $name) { pullRequest(number: $pr) { baseRefName
    timelineItems(itemTypes: [BASE_REF_CHANGED_EVENT], last: 100) {
      nodes { ... on BaseRefChangedEvent { createdAt previousRefName currentRefName } } } } } }'
# GitHub sets the commit time of a merge commit to the time it builds it.
built_at=$(git show -s --format=%ct HEAD)

# The last base change up to built_at names the base. With no such change, the base before the
# first change does, and with no change at all, the base of the PR.
if ! request=$(jq -cn --arg query "$query" --arg repository "$repository" --arg pr "$pr" \
    '{query: $query, variables: {owner: ($repository | split("/")[0]), name: ($repository | split("/")[1]), pr: ($pr | tonumber)}}') ||
  ! response=$(curl -sSf --max-time 30 --retry 2 -H "Authorization: Bearer ${GH_TOKEN:?GH_TOKEN is not set}" \
    -H 'Content-Type: application/json' -d "$request" "${GITHUB_GRAPHQL_URL:-https://api.github.com/graphql}") ||
  ! base=$(jq -er --argjson built_at "$built_at" '.data.repository.pullRequest
    | .timelineItems.nodes as $changes
    | ([$changes[] | select((.createdAt | fromdateiso8601) <= $built_at)] | last | .currentRefName)
      // $changes[0].previousRefName // .baseRefName' <<<"$response"); then
  echo ">>> cannot read the base changes of PR #$pr — the base branch is '$base_ref'" >&2
  echo "$base_ref"
  exit 0
fi

if [ "$base" != "$base_ref" ]; then
  echo ">>> the event names '$base_ref', but HEAD is built on '$base'" >&2
fi
echo "$base"
