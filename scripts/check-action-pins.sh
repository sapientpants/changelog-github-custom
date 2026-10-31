#!/usr/bin/env bash

# Verify that every external GitHub Action / reusable workflow referenced from
# .github/ is pinned to a full 40-character commit SHA with the release tag kept
# as a trailing comment, e.g.
#
#   uses: actions/checkout@<40-hex-sha> # v5.1.0
#
# Mutable tags (@v5) or branches (@main) can be moved by the action's maintainer
# or by anyone who compromises their repository, so the code running in CI and
# in the release pipeline would change without any change on our side.
# Dependabot (.github/dependabot.yml, github-actions ecosystem) bumps the SHA and
# the version comment together.
#
# Local references (uses: ./...) and docker:// images are not checked here.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

files=()
while IFS= read -r f; do
    files+=("$f")
done < <(find .github/workflows .github/actions -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | sort)

if [ "${#files[@]}" -eq 0 ]; then
    echo -e "${RED}No workflow or action files found under .github/${NC}"
    exit 1
fi

violations=0
while IFS=: read -r file line content; do
    # Strip leading whitespace and an optional list dash
    ref="${content#"${content%%[![:space:]]*}"}"
    ref="${ref#- }"
    ref="${ref#"${ref%%[![:space:]]*}"}"

    # Skip comments and local / docker references
    case "$ref" in
        \#*) continue ;;
        uses:\ ./*) continue ;;
        uses:\ docker://*) continue ;;
    esac

    if ! [[ "$ref" =~ ^uses:\ [^@[:space:]]+@[0-9a-f]{40}\ #\ v[0-9][^[:space:]]*$ ]]; then
        echo -e "${RED}${file}:${line}: not pinned to a commit SHA with a version comment:${NC} ${ref}"
        violations=$((violations + 1))
    fi
done < <(grep -nHE '^\s*(- )?(#\s*)?uses:' "${files[@]}" || true)

if [ "$violations" -gt 0 ]; then
    echo ""
    echo -e "${RED}✗ ${violations} unpinned action reference(s) found${NC}"
    echo "Pin each one as: uses: <owner>/<repo>@<40-char commit sha> # <release tag>"
    exit 1
fi

echo -e "${GREEN}✓ All external action references are pinned to commit SHAs${NC}"
