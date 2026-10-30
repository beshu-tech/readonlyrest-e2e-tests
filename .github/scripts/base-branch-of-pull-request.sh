#!/usr/bin/env bash
# Prints the branch that the code of a pull request run is based on.
#
# The run tests HEAD: the merge commit that GitHub builds from the PR and the tip of its base
# branch. The base_ref of the event can name another branch. When the base of the PR changes a
# few seconds before a push, the event of the push can carry the old base, and GitHub builds the
# merge commit on the new one. The plugin images of the old base then run against the tests of
# the new base.
#
# The first parent of HEAD is the tip of the base branch at the build. The branch whose tip is that
# commit wins, and base_ref goes first. When no tip matches, because the base branch moved after
# the build or origin did not answer, base_ref is the only fact left.
#
# Usage: base-branch-of-pull-request.sh <github.base_ref>
set -uo pipefail

base_ref=${1:?Usage: $0 <github.base_ref>}

# The checkout is shallow, so HEAD^1 does not resolve. The commit object still names its parents.
base_tip=$(git cat-file -p HEAD | awk '/^parent / { print $2; exit }')

tips=$(git ls-remote --heads origin "refs/heads/$base_ref" refs/heads/develop refs/heads/master) || {
  echo ">>> cannot read the branches of origin — the base branch is '$base_ref'" >&2
  tips=""
}

for branch in "$base_ref" develop master; do
  if [ -n "$base_tip" ] && grep -qxF "$base_tip"$'\t'"refs/heads/$branch" <<<"$tips"; then
    [ "$branch" != "$base_ref" ] &&
      echo ">>> the event names '$base_ref', but HEAD is built on the tip of '$branch'" >&2
    echo "$branch"
    exit 0
  fi
done

echo ">>> no branch tip is the base of HEAD ($base_tip) — the base branch is '$base_ref'" >&2
echo "$base_ref"
