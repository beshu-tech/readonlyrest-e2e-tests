#!/bin/bash -e

# Checks out the branch of this repo that fits the branch of a caller. A plugin repo passes its own
# branch and the branch its change is based on, and knows nothing of the branches here.
#
# The first branch that exists wins: the target, the fallback, `develop`, `master`. A browser test
# for a plugin change lives on a branch with the same name. Without one, the base branch of the
# change is the best fit: `develop` and `master` can hold different tests. `develop` comes before
# `master`, because a manual run of a feature branch has no base branch.
#
# Usage: ci/checkout-matching-branch.sh <target branch> [<fallback branch>]
# Returns: 1 usage, 3 no branch exists or the branches of origin cannot be read.

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] || [ -z "$1" ]; then
  echo "Usage: $0 <target branch> [<fallback branch>]" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

TRIED=()
for BRANCH in "$1" "${2:-}" develop master; do
  if [ -z "$BRANCH" ] || printf '%s\n' "${TRIED[@]}" | grep -qxF -- "$BRANCH"; then
    continue
  fi
  TRIED+=("$BRANCH")
  STATUS=0
  git ls-remote --exit-code --heads origin "refs/heads/$BRANCH" >/dev/null || STATUS=$?
  if [ "$STATUS" -eq 0 ]; then
    git fetch --quiet --depth 1 origin "refs/heads/$BRANCH"
    git checkout --quiet -B "$BRANCH" FETCH_HEAD
    echo ">>> e2e tests branch: $BRANCH ($(git rev-parse --short HEAD))"
    exit 0
  fi
  # 2 means that origin has no such branch. Another code means that git could not ask.
  if [ "$STATUS" -ne 2 ]; then
    echo "ERROR: cannot read the branches of origin (git ls-remote exit $STATUS)" >&2
    exit 3
  fi
  echo ">>> No e2e tests branch '$BRANCH'"
done

echo "ERROR: none of the branches [${TRIED[*]}] exists in origin" >&2
exit 3
