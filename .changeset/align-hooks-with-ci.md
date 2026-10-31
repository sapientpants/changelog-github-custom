---
---

Fix git hooks: `pre-commit` now runs `lint-staged` and `pre-push` runs `quick-check` instead of the full `verify` on every commit; remove the no-op `--no-verify` guard; run markdown, YAML and dependency checks in CI so hooks and CI use the same check set; lint root markdown files; drop the divergent `scripts/ci-local.sh`.
