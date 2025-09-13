# changelog-github-custom

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
