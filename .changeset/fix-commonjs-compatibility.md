---
"changelog-github-custom": patch
---

Fix CommonJS module compatibility by removing type:module from package.json

Resolved an issue where the package would fail when loaded by changesets with the error "exports is not defined in ES module scope". The package.json had "type": "module" which caused Node.js to treat CommonJS files as ESM modules. Following the same approach as @changesets/changelog-github, removed the type field to allow proper dual module support.