---
'changelog-github-custom': patch
---

Fix critical build failure in Main workflow

- Build TypeScript before running changeset version to ensure custom changelog generator is available
- Add OSV scanner configuration to suppress false positive validator.js vulnerability in dev dependencies
- Resolve MODULE_NOT_FOUND error that was blocking releases since PR #26
