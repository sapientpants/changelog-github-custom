---
'changelog-github-custom': patch
---

Fix GitHub release creation when Docker build is disabled

The create-release job was blocked when the docker job was skipped due to ENABLE_DOCKER_RELEASE not being set. Updated the conditional to properly handle skipped dependencies, allowing releases to be created even when optional build jobs (docker/npm) are disabled.
