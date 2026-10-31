---
'changelog-github-custom': patch
---

Degrade gracefully on every GitHub lookup failure: a rejected `getPullRequestInfo` (summary with a `PR:` line) or a rejected `getCommitInfo` inside `getDependencyReleaseLine` now yields an entry without links instead of aborting `changeset version`, matching what the commit-lookup path already did. Export the `Options` type, validate the `repo` option through a single type guard, and replace deprecated `trimRight()` with `trimEnd()`.
