# Branching

## The two long-lived branches

- `master` tests the released plugins. Its CI runs the suite against the published images (`--mode prod`, `ror-latest`) on every push to `master`, on every pull request that targets `master`, and on the nightly schedule.
- `develop` tests the plugin code that is not released yet. Its CI builds branch-matched dev images of the ES and the Kibana plugin, then runs the suite against them.

Both branches hold the same tests. The branch decides which plugin build the tests run against. `.github/workflows/all-e2e-tests.yml` holds the two job sets.

The repo has no version and no release of its own. It follows the two plugin repos, which release together.

## Which branch does a PR target?

**Target `develop`.** A test for plugin behaviour that is not released yet goes to `develop`, and so does every change that only the dev-image path needs.

**Target `master` when the released plugins need the change now, not later.** These cases qualify:

1. **Support for a new ES, Kibana or ECK version.** The version must reach the matrix as soon as the plugins support it, so the nightly run covers it. Most PRs to `master` are of this kind.
2. **A new test that covers the released plugins too.** The behaviour under test is already out, so `master` must run the test against it. A test for behaviour that arrives with the next release targets `develop`.
3. **A fix for a test that fails against the released plugins.** A flaky test counts. The nightly run on `master` stays red until the fix lands there.
4. **A pipeline, workflow or runner change.** `master` runs the nightly and the full matrix, so it needs the current pipeline.
5. **Cleanup after a ROR release.** Fallbacks for versions we no longer support, and the settings the release made obsolete.
6. **Docs that describe the released setup.**

Everything else targets `develop`. Two questions decide a case that is not on the list. Do the released plugins need the change now? Does the change leave the dev-image path untouched? If both answers are no, the PR targets `develop`.

## After a merge to master

Merge `master` back into `develop`:

```bash
git checkout develop && git pull
git merge origin/master
```

The change must exist on both branches. Without the merge back, `develop` loses it at the next sync.

A change that lands on `develop` reaches `master` the other way: open a PR that merges `develop` into `master` once the plugins that need it are released. Name the changes it carries in the description.

When the two branches have moved apart too far for one merge, open one PR per branch. Say so in both descriptions and link them.
