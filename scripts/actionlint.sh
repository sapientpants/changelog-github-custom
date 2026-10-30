#!/usr/bin/env bash

# Wrapper script for actionlint - GitHub Actions workflow linter
# Checks if actionlint is installed and provides installation instructions if not.
# In CI the binary is required: a missing install must fail the job, not pass silently.

set -uo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if actionlint is installed
if ! command -v actionlint &> /dev/null; then
    # In CI the install step is responsible for providing the binary. Never skip here:
    # a silent exit 0 would let a broken install step make workflow linting "pass".
    if [ "${CI:-false}" = "true" ] || [ "${GITHUB_ACTIONS:-false}" = "true" ]; then
        echo -e "${RED}Error: actionlint is not installed in CI${NC}"
        echo "Add the .github/actions/install-actionlint step to this job before any step that commits or runs lint:workflows"
        exit 1
    fi
    
    # In local development, provide installation instructions
    echo -e "${RED}Error: actionlint is not installed${NC}"
    echo ""
    echo -e "${YELLOW}Please install actionlint using one of the following methods:${NC}"
    echo ""
    echo -e "${BLUE}macOS/Linux (Homebrew):${NC}"
    echo "  brew install actionlint"
    echo ""
    echo -e "${BLUE}Go:${NC}"
    echo "  go install github.com/rhysd/actionlint/cmd/actionlint@latest"
    echo ""
    echo -e "${BLUE}Download binary:${NC}"
    echo "  https://github.com/rhysd/actionlint/releases"
    echo ""
    echo "After installation, run this script again."
    exit 1
fi

# Run actionlint with provided arguments or default to checking .github/workflows/
if [ $# -eq 0 ]; then
    echo -e "${GREEN}Running actionlint on .github/workflows/...${NC}"
    # Run actionlint and capture output
    OUTPUT=$(actionlint 2>&1)
    EXIT_CODE=$?
    
    if [ -n "$OUTPUT" ]; then
        # Always show the output for transparency
        echo "$OUTPUT"
        
        # Store grep results in variables to avoid redundant processing
        HAS_SHELLCHECK_INFO=0
        HAS_SHELLCHECK_ERRORS=0
        if echo "$OUTPUT" | grep -q "SC[0-9]*:info:"; then
            HAS_SHELLCHECK_INFO=1
        fi
        if echo "$OUTPUT" | grep -qE "SC[0-9]*:(error|warning):"; then
            HAS_SHELLCHECK_ERRORS=1
        fi

        # Check if output only contains shellcheck info warnings
        if [ "$HAS_SHELLCHECK_INFO" -eq 1 ]; then
            # Has shellcheck info warnings - check if there are also errors
            if [ "$HAS_SHELLCHECK_ERRORS" -eq 1 ]; then
                # There are actual errors or warnings beyond info level
                echo ""
                echo -e "${RED}✗ Workflow validation failed - errors or warnings found${NC}"
                exit 1
            else
                # Only shellcheck info warnings
                echo ""
                echo -e "${YELLOW}ℹ Info: Minor shellcheck suggestions found (not blocking)${NC}"
                echo -e "${GREEN}✓ All workflow files are valid${NC}"
                exit 0
            fi
        else
            # Output exists but no shellcheck warnings - must be errors
            echo ""
            echo -e "${RED}✗ Workflow validation failed${NC}"
            exit 1
        fi
    else
        # No output means success
        echo -e "${GREEN}✓ All workflow files are valid - no issues found${NC}"
        exit 0
    fi
else
    actionlint "$@"
fi