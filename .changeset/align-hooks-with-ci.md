---
---

Fix git hooks: `pre-commit` now runs `lint-staged` and `pre-push` runs `quick-check` instead of the full `verify` on every commit; remove the no-op `--no-verify` guard; run markdown, YAML and dependency checks in CI so hooks and CI use the same check set; move markdownlint ignores from `.markdownlintignore` (which markdownlint-cli2 never read) to `.markdownlint-cli2.yaml` so `CHANGELOG.md`, `coverage/` and `dist/` are actually skipped; drop the divergent `scripts/ci-local.sh`.
