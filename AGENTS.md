# AGENTS.md

## Setup & Tooling

- **Package manager**: pnpm 10.17.0 (enforced via `packageManager` field + `engine-strict=true` in `.npmrc`)
- **Node**: >= 22 (enforced by `.npmrc` + `mise.toml`)
- **Install**: `pnpm install` (husky `prepare` hook runs automatically)

## Key Commands

| Command                | What it does                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `pnpm verify`          | Full precommit: audit, deps check, typecheck, lint (TS/ES/YAML/Markdown), format, tests |
| `pnpm quick-check`     | Fast path: typecheck + lint + test (no format/workflows)                                |
| `pnpm build`           | Clean + ESM (`tsconfig.esm.json`) — single `tsc` invocation emits JS and declarations   |
| `pnpm test`            | `vitest run --reporter=verbose`                                                         |
| `pnpm changeset`       | Create a changeset (generates file in `.changeset/`)                                    |
| `pnpm release`         | `changeset version && pnpm build`                                                       |
| `pnpm release:publish` | `pnpm build && changeset publish`                                                       |
| `pnpm ci:local`        | Run CI workflows locally (`./scripts/ci-local.sh`)                                      |

## Architecture

- **Single library**: `src/changelog-custom.ts` — a Changesets `ChangelogFunctions` implementation
- **ESM-only output**: JS at `dist/esm/`, types at `dist/types/` (no CJS build — `"type": "module"` means `tsc` emits ESM regardless; `require()` works via Node 22.12+ `require(esm)`)
- **Two tsconfigs**: base (`tsconfig.json`) for typecheck/lint, ESM (`tsconfig.esm.json`) for build
- **Tests**: `tests/changelog-custom.spec.ts` — mocks `@changesets/get-github-info` via `vi.mock()`
- **Changesets config**: `.changeset/config.json` — uses custom changelog generator (`../dist/esm/changelog-custom.js`), `baseBranch: "main"`, `commit: false`

## Git & Hooks

- **SSH auth / agent**: if a `git push`/`git fetch` fails with an SSH auth or "identity" error, **stop and wait** for the user to handle authentication — do NOT rewrite remotes, `git config`, or debug ssh. Original `origin` must stay an **ssh** remote (`git@github.com:...`), never https.

- **Husky**: pre-commit, commit-msg (commitlint conventional), pre-push
- **Pre-push blocks `--no-verify`**: intentionally disallowed — all commits must pass hooks
- **Commit messages**: conventional commits via `@commitlint/config-conventional`
- **lint-staged**: runs prettier, eslint, markdownlint, yamllint on staged files

## Constraints

- No `.env` files — secrets managed via GitHub Actions repository secrets (`RELEASE_TOKEN`, `NPM_TOKEN`, etc.)
- `pnpm.overrides` pins several transitive deps (tar, undici, uuid, validator, vite, yaml) — don't upgrade without checking overrides
- ESLint uses type-checked rules on `src/**/*.ts` and `tests/**/*.ts` — `tsc` must pass before lint passes
