# AGENTS.md

## Setup & Tooling

- **Package manager**: pnpm 11.20.0 (enforced via `packageManager` field + `engine-strict=true` in `.npmrc`)
- **Node**: >= 22.12 is the consumer floor (`engines.node`, enforced by `engine-strict=true` in `.npmrc`); `mise.toml` and CI pin Node 24 for development
- **Install**: `pnpm install` (husky `prepare` hook runs automatically)

## Key Commands

| Command                | What it does                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify`          | Full CI-equivalent set: audit, deps check, typecheck, lint (TS/ES/YAML/Markdown/workflows/action pins), format, tests+coverage |
| `pnpm quick-check`     | Fast path: typecheck + lint + test (what `pre-push` runs)                                                                      |
| `pnpm build`           | Clean + ESM (`tsconfig.esm.json`) — single `tsc` invocation emits JS and declarations                                          |
| `pnpm test`            | `vitest run --reporter=verbose`                                                                                                |
| `pnpm changeset`       | Create a changeset (generates file in `.changeset/`)                                                                           |
| `pnpm release`         | `changeset version && pnpm build`                                                                                              |
| `pnpm release:publish` | `pnpm build && changeset publish`                                                                                              |

## Architecture

- **Single library**: `src/changelog-custom.ts` — a Changesets `ChangelogFunctions` implementation
- **ESM-only output**: JS at `dist/esm/`, types at `dist/types/` (no CJS build — `"type": "module"` means `tsc` emits ESM regardless; `require()` works via Node 22.12+ `require(esm)`)
- **Two tsconfigs**: base (`tsconfig.json`) for typecheck/lint, ESM (`tsconfig.esm.json`) for build
- **Tests**: `tests/changelog-custom.spec.ts` — mocks `@changesets/get-github-info` via `vi.mock()`
- **Changesets config**: `.changeset/config.json` — uses custom changelog generator (`../dist/esm/changelog-custom.js`), `baseBranch: "main"`, `commit: false`

## Git & Hooks

- **SSH auth / agent**: if a `git push`/`git fetch` fails with an SSH auth or "identity" error, **stop and wait** for the user to handle authentication — do NOT rewrite remotes, `git config`, or debug ssh. Original `origin` must stay an **ssh** remote (`git@github.com:...`), never https.

- **Husky**: `pre-commit` → `lint-staged` (prettier, eslint, markdownlint, yamllint on staged files); `commit-msg` → commitlint; `pre-push` → `pnpm quick-check`
- **Hooks are a convenience, not enforcement**: `--no-verify` skips them entirely and cannot be detected client-side. The full check set (`pnpm verify`) runs in CI on every PR/push, and branch protection on `main` is the gate
- **Commit messages**: conventional commits via `@commitlint/config-conventional`
- **Keep `verify` and CI in sync**: `reusable-validate.yml` + `reusable-security.yml` must run the same checks as the `verify` script
- **Pinned actions**: every external `uses:` in `.github/` is pinned to a full commit SHA with the release tag as a trailing comment (`uses: owner/repo@<sha> # vX.Y.Z`); `pnpm lint:action-pins` fails otherwise, and Dependabot (`github-actions` ecosystem) bumps the SHA and comment together

## Constraints

- No `.env` files — the only GitHub Actions repository secret is `RELEASE_TOKEN` (npm publishing uses OIDC trusted publishing, so there is no `NPM_TOKEN`)
- `overrides` in `pnpm-workspace.yaml` (not `package.json`) force patched versions of a few transitive devDependencies (glob, minimatch, re2js, katex) — check them before upgrading those packages, and drop an override once the upstream fix is released
- ESLint uses type-checked rules on `src/**/*.ts` and `tests/**/*.ts` — `tsc` must pass before lint passes
