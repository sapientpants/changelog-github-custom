# changelog-github-custom

## 1.2.5

### Patch Changes

- [#11](https://github.com/sapientpants/changelog-github-custom/pull/11) [`e9def97`](https://github.com/sapientpants/changelog-github-custom/commit/e9def97e8578206c2ebc8c55e2b0b832082b9f12) - Add @changesets/get-github-info as dependency for enhanced GitHub integration capabilities

## 1.2.4

### Patch Changes

- [#10](https://github.com/sapientpants/changelog-github-custom/pull/10) [`01b8cf1`](https://github.com/sapientpants/changelog-github-custom/commit/01b8cf1da34e9543ade6ed9545168a4e96f920dc) - Fix CommonJS module compatibility by removing type:module from package.json

  Resolved an issue where the package would fail when loaded by changesets with the error "exports is not defined in ES module scope". The package.json had "type": "module" which caused Node.js to treat CommonJS files as ESM modules. Following the same approach as @changesets/changelog-github, removed the type field to allow proper dual module support.

## 1.2.3

### Patch Changes

- [#9](https://github.com/sapientpants/changelog-github-custom/pull/9) [`a857c56`](https://github.com/sapientpants/changelog-github-custom/commit/a857c56fea377c3916da13ac117384c72d9d1771) - Add dual module support (ESM + CommonJS) for compatibility with changesets
  - Configure separate TypeScript builds for ESM and CommonJS outputs
  - Update package.json exports to support both require() and import
  - Add dedicated build configs for each module format
  - Update build:watch script to support the new build structure
  - Fixes compatibility issue where changesets couldn't load the formatter using require()

## 1.2.2

### Patch Changes

- [#8](https://github.com/sapientpants/changelog-github-custom/pull/8) [`95fb130`](https://github.com/sapientpants/changelog-github-custom/commit/95fb1309a1fb36afa72c4086430d65a9f72c36f6) - Update dev dependencies
  - Updated @types/node from 24.3.3 to 24.4.0

## 1.2.1

### Patch Changes

- [#6](https://github.com/sapientpants/changelog-github-custom/pull/6) [`89ff475`](https://github.com/sapientpants/changelog-github-custom/commit/89ff47573ef7fc2ac912fcbef19228e69ffb1c49) - Fix package.json exports configuration to resolve ERR_PACKAGE_PATH_NOT_EXPORTED error
  - Corrected main and exports fields to point to the actual built file location (dist/src/changelog-custom.js)
  - Removed incorrect CommonJS exports since this is an ESM-only package (type: module)
  - Added types export for better TypeScript support

## 1.2.0

### Minor Changes

- [#5](https://github.com/sapientpants/changelog-github-custom/pull/5) [`1f8ff08`](https://github.com/sapientpants/changelog-github-custom/commit/1f8ff08404100a6dd2d180d3239cdb42382dbe66) - feat: prepare package for public npm publishing
  - Added package metadata including description, author, and keywords
  - Configured package as public with proper npm publish settings
  - Added repository information
  - Specified main entry point and exports
  - Defined files to be included in the published package

## 1.1.0

### Minor Changes

- [#4](https://github.com/sapientpants/changelog-github-custom/pull/4) [`8c8eb40`](https://github.com/sapientpants/changelog-github-custom/commit/8c8eb4009004afd86b57fc5032bbebac4cc4e7ae) - feat: Add depcheck to detect and fail build on unused dependencies
  - Added depcheck tool to validate all declared dependencies are actually used
  - Integrated depcheck into CI/CD pipeline and pre-commit hooks
  - Configured .depcheckrc with appropriate ignore patterns for build tools
  - Removed unused dependencies discovered during implementation
  - Build now fails with clear error message when unused dependencies are found

  Closes #3

## 1.0.0

### Major Changes

- [`54aad11`](https://github.com/sapientpants/changelog-github-custom/commit/54aad111564b1b07115efb92bf00e06923b7751a) - Reset version to 0.0.1 for initial public release

  This is a major change as we're resetting the version numbering scheme from 0.22.1 to 0.0.1 to prepare for the initial public npm release.

## 0.0.1

### Initial Release

Initial public release of changelog-github-custom, a custom changelog generator for GitHub repositories using Changesets.

#### Features

- Custom changelog generation with GitHub integration
- Pull request and commit linking
- Dependency update tracking
- Markdown formatting optimized for GitHub

#### Recent Updates

- [`8d36651`](https://github.com/sapientpants/changelog-github-custom/commit/8d366518b7dcf9cf05ccaf1e14050d94d21caa24) - Add repository field to package.json for better npm metadata and remove private field to allow npm publishing
- [`7f8918e`](https://github.com/sapientpants/changelog-github-custom/commit/7f8918e1b1523d2eec1744a2da9b964a59591925) - Fixed markdown linting issues and removed local settings from git tracking
  - Fixed MD031 (blanks around fences) in spec-feature.md
  - Fixed MD040 (fenced code language) in spec-feature.md
  - Fixed MD013 (line length) issues in update-dependencies.md and WORKFLOWS.md
  - Fixed MD026 (trailing punctuation) in update-dependencies.md
  - Removed .claude/settings.local.json from git tracking (already in .gitignore)
