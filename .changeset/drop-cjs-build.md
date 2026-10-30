---
'changelog-github-custom': patch
---

Drop the CommonJS build target and lower the Node floor to 22.12.

The `dist/cjs` output was byte-identical ESM (the root `package.json` has `"type": "module"`), so the `require` export condition already pointed at an ES module. The package is now built once as ESM; `require()` continues to work on Node 22.12+ via `require(esm)`, and Changesets loads changelog modules with `import()`. `engines.node` is now `>=22.12.0`, the first release where `require(esm)` is enabled by default.
