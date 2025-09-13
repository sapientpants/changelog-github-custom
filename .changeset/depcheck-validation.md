---
'changelog-github-custom': minor
---

feat: Add depcheck to detect and fail build on unused dependencies

- Added depcheck tool to validate all declared dependencies are actually used
- Integrated depcheck into CI/CD pipeline and pre-commit hooks
- Configured .depcheckrc with appropriate ignore patterns for build tools
- Removed unused dependencies discovered during implementation
- Build now fails with clear error message when unused dependencies are found

Closes #3
