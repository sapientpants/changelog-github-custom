---
---

Remove pnpm overrides and `allowBuilds` entries left over from the cdxgen removal (tar, sequelize, read-yaml-file, jsonata, body-parser, uuid, undici, browserslist data, esbuild, @appthreat/sqlite3) and overrides whose upstream fixes are now in the tree (js-yaml, markdown-it, launch-editor, shell-quote, source-map-js, fast-uri, yaml); only glob, minimatch, re2js and katex still need forcing (no runtime changes).
