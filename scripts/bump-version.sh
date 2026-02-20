#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PACKAGE_JSON="$ROOT_DIR/package.json"
TAURI_CONF="$ROOT_DIR/src-tauri/tauri.conf.json"
CARGO_TOML="$ROOT_DIR/src-tauri/Cargo.toml"

DRY_RUN=false
NO_GIT=false
BUMP_TYPE=""
SET_VERSION=""

usage() {
    echo "Usage: $0 <patch|minor|major> [--dry-run] [--no-git]"
    echo "       $0 --set <version> [--dry-run] [--no-git]"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        patch|minor|major) BUMP_TYPE="$1"; shift ;;
        --set) SET_VERSION="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --no-git) NO_GIT=true; shift ;;
        *) usage ;;
    esac
done

if [[ -z "$BUMP_TYPE" && -z "$SET_VERSION" ]]; then
    usage
fi

CURRENT=$(jq -r '.version' "$PACKAGE_JSON")
echo "Current version: $CURRENT"

if [[ -n "$SET_VERSION" ]]; then
    NEW="$SET_VERSION"
else
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    case "$BUMP_TYPE" in
        patch) PATCH=$((PATCH + 1)) ;;
        minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
        major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    esac
    NEW="${MAJOR}.${MINOR}.${PATCH}"
fi

echo "New version: $NEW"

if $DRY_RUN; then
    echo "[dry-run] Would update:"
    echo "  $PACKAGE_JSON"
    echo "  $TAURI_CONF"
    echo "  $CARGO_TOML"
    echo "  Cargo.lock (via cargo update)"
    echo "  git commit + tag v$NEW"
    exit 0
fi

# Update package.json
jq --arg v "$NEW" '.version = $v' "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp" && mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"

# Update tauri.conf.json
jq --arg v "$NEW" '.version = $v' "$TAURI_CONF" > "$TAURI_CONF.tmp" && mv "$TAURI_CONF.tmp" "$TAURI_CONF"

# Update Cargo.toml (first version = line only)
sed -i '' "0,/^version = \".*\"/s//version = \"$NEW\"/" "$CARGO_TOML"

# Update Cargo.lock
(cd "$ROOT_DIR/src-tauri" && cargo update -p arc 2>/dev/null || true)

echo "Updated all version files to $NEW"

if $NO_GIT; then
    echo "Skipping git operations (--no-git)"
    exit 0
fi

# Git commit and tag
cd "$ROOT_DIR"
git add "$PACKAGE_JSON" "$TAURI_CONF" "$CARGO_TOML" src-tauri/Cargo.lock
git commit -m "chore: bump version to v${NEW}"
git tag -a "v${NEW}" -m "Release v${NEW}"

echo ""
echo "Created commit and tag v${NEW}"
echo "Run 'git push && git push --tags' to trigger the release."
