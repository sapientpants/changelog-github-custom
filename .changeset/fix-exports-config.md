---
'changelog-github-custom': patch
---

Fix package.json exports configuration to resolve ERR_PACKAGE_PATH_NOT_EXPORTED error

- Corrected main and exports fields to point to the actual built file location (dist/src/changelog-custom.js)
- Removed incorrect CommonJS exports since this is an ESM-only package (type: module)
- Added types export for better TypeScript support
