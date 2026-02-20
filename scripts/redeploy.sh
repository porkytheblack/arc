#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
    VERSION="v$(jq -r '.version' "$ROOT_DIR/package.json")"
    echo "No version specified, using current: $VERSION"
fi

# Ensure v prefix
[[ "$VERSION" != v* ]] && VERSION="v$VERSION"

# Validate clean state
if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: Uncommitted changes. Commit or stash first."
    exit 1
fi

echo "Redeploying $VERSION..."

# Delete and recreate tag
git tag -d "$VERSION" 2>/dev/null || true
git push origin ":refs/tags/$VERSION" 2>/dev/null || true
git tag -a "$VERSION" -m "Release $VERSION"
git push origin "refs/tags/$VERSION"

echo "Tag $VERSION recreated and pushed. CI workflow will trigger."
