# changelog-github-custom

<p align="center">
  <a href="https://github.com/sapientpants/changelog-github-custom/actions/workflows/main.yml">
    <img src="https://github.com/sapientpants/changelog-github-custom/actions/workflows/main.yml/badge.svg" alt="CI">
  </a>
  <a href="https://sonarcloud.io/summary/new_code?id=changelog-github-custom">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=changelog-github-custom&metric=alert_status" alt="Quality Gate Status">
  </a>
  <a href="https://sonarcloud.io/summary/new_code?id=changelog-github-custom">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=changelog-github-custom&metric=bugs" alt="Bugs">
  </a>
  <a href="https://sonarcloud.io/summary/new_code?id=changelog-github-custom">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=changelog-github-custom&metric=code_smells" alt="Code Smells">
  </a>
  <a href="https://sonarcloud.io/summary/new_code?id=changelog-github-custom">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=changelog-github-custom&metric=coverage" alt="Coverage">
  </a>
  <a href="https://sonarcloud.io/summary/new_code?id=changelog-github-custom">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=changelog-github-custom&metric=duplicated_lines_density" alt="Duplicated Lines (%)">
  </a>
  <a href="https://www.npmjs.com/package/changelog-github-custom">
    <img src="https://img.shields.io/npm/v/changelog-github-custom.svg" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/changelog-github-custom">
    <img src="https://img.shields.io/npm/dm/changelog-github-custom.svg" alt="npm downloads">
  </a>
  <a href="https://github.com/sapientpants/changelog-github-custom/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/changelog-github-custom.svg" alt="License">
  </a>
</p>

A [Changesets](https://github.com/changesets/changesets) changelog generator for GitHub repositories. It produces the same output as [`@changesets/changelog-github`](https://www.npmjs.com/package/@changesets/changelog-github), with each entry linked to its pull request and commit, but omits the trailing `Thanks @user!` attribution.

## Install

```sh
pnpm add -D changelog-github-custom
```

```sh
npm install --save-dev changelog-github-custom
```

## Configuration

Point the `changelog` entry in `.changeset/config.json` at this package and pass the `owner/repo` slug of your GitHub repository:

```json
{
  "changelog": ["changelog-github-custom", { "repo": "owner/repo" }]
}
```

The `repo` option is required. Without it the generator throws when `changeset version` runs.

### GitHub token

PR and commit links are resolved through [`@changesets/get-github-info`](https://www.npmjs.com/package/@changesets/get-github-info), which calls the GitHub API. Set `GITHUB_TOKEN` in the environment where `changeset version` runs, for example:

```sh
GITHUB_TOKEN=ghp_... pnpm changeset version
```

In GitHub Actions the workflow token works:

```yaml
- run: pnpm changeset version
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Lookups are best-effort. If the API call fails or the PR or commit cannot be found, the entry is still written, just without links; `changeset version` does not abort. A failed API call (for example a missing `GITHUB_TOKEN`) is reported on stderr so the missing links are not a surprise.

## Usage

Write changesets as usual with `pnpm changeset`. When `changeset version` runs, each changeset summary becomes one changelog entry.

### Summary front-matter

The first lines of a changeset summary can carry metadata. Each matching line is removed from the summary before it is written to the changelog.

| Line                                       | Effect                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `PR: #123` (also `pull:`, `pull request:`) | Link the entry to pull request 123. The commit link is taken from that PR's merge commit.   |
| `commit: <sha>`                            | Link the entry to this commit. Overrides the commit derived from the PR or the changeset.   |
| `author: @user` / `user: @user`            | Stripped. This generator does not print attribution, so the line is accepted and discarded. |

When no `PR:` line is present, the generator looks up the commit that added the changeset file (or the `commit:` override) and takes the PR link from that commit, if GitHub reports one.

Example changeset:

```md
---
'my-package': patch
---

PR: #123
author: @octocat

Fix a crash when the config file is empty.

The loader now treats an empty file the same as `{}`.
```

### Example output

```md
## 1.2.10

### Patch Changes

- [#123](https://github.com/owner/repo/pull/123) [`b4092b5`](https://github.com/owner/repo/commit/b4092b5b6247bcd64f318c3c8a2eebdb00655b09) - Fix a crash when the config file is empty.

  The loader now treats an empty file the same as `{}`.

- Updated dependencies [[`51da22a`](https://github.com/owner/repo/commit/51da22a453d0d6d8c4b79f5321aa7bdfa04c9d9c)]:
  - my-other-package@2.0.1
```

Continuation lines of a multi-line summary are indented under the entry. Entries whose links cannot be resolved are written without the link prefix.

## Requirements

- Node.js 22.12 or later
- The package is published as ESM only. Changesets loads changelog modules with `import()`, so this works with any Changesets setup. `require()` also works on Node 22.12+.

## License

[MIT](LICENSE)
