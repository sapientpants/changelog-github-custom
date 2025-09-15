---
'changelog-github-custom': patch
---

Add dual module support (ESM + CommonJS) for compatibility with changesets

- Configure separate TypeScript builds for ESM and CommonJS outputs
- Update package.json exports to support both require() and import
- Add dedicated build configs for each module format
- Update build:watch script to support the new build structure
- Fixes compatibility issue where changesets couldn't load the formatter using require()
