#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Project Setup Script
# Purpose: One-command setup for new contributors
# Usage: ./scripts/setup.sh  (or: pnpm setup)
#
# Tool versions are not hardcoded here. They come from:
#   - mise.toml          -> node / pnpm versions used for development and CI
#   - package.json       -> packageManager (pnpm) and engines.node (consumer floor)
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[SETUP]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if we're in the right directory
if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    error "Run this script from the project root directory"
fi

cd "$PROJECT_ROOT"

log "Starting project setup..."

# 1. Check prerequisites
log "Checking prerequisites..."

if command -v mise &> /dev/null; then
    log "Installing toolchain from mise.toml..."
    mise install
fi

# Verify the tools are actually on PATH. With mise this fails when it is
# installed but not activated in the current shell (see `mise activate`).
if ! command -v node &> /dev/null; then
    error "Node.js not found. Install the version pinned in mise.toml, or install and activate mise (https://mise.jdx.dev/getting-started.html)."
fi
if ! command -v pnpm &> /dev/null; then
    error "pnpm not found. Install the version pinned in package.json's packageManager field, or install and activate mise."
fi

# 2. Install dependencies (the husky prepare hook runs automatically)
log "Installing dependencies..."
pnpm install

# 3. Run initial verification
log "Running initial verification..."
if pnpm verify; then
    log "✅ All checks passed!"
else
    warn "Some checks failed. Fix issues before committing."
fi

# 4. Create initial build
log "Creating initial build..."
pnpm build

# 5. Show next steps
echo
log "🎉 Setup complete!"
echo
info "Next steps:"
echo "1. Open the project in your IDE (VS Code recommended)"
echo "2. Start developing with: pnpm test:watch"
echo "3. Add a changeset for your change with: pnpm changeset"
echo
info "Available commands:"
echo "  pnpm dev           # Start development mode"
echo "  pnpm test:watch    # Run tests in watch mode"
echo "  pnpm quick-check   # typecheck + lint + test (what pre-push runs)"
echo "  pnpm verify        # Run all quality checks (what CI runs)"
echo "  pnpm changeset     # Create a changeset for your changes"
echo
info "Documentation:"
echo "  README.md            - Install, configuration and usage"
echo "  AGENTS.md            - Tooling, commands, architecture and hooks"
echo "  .github/WORKFLOWS.md - CI and release workflows"
