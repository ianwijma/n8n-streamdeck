#!/bin/bash

# N8N StreamDeck Release Script
# Handles version tagging, changelog generation, and release asset creation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RELEASE_TYPE=${1:-patch}  # major, minor, patch, or specific version
DRY_RUN=${DRY_RUN:-false}
SKIP_BUILD=${SKIP_BUILD:-false}
SKIP_TESTS=${SKIP_TESTS:-false}

# Directories
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="${ROOT_DIR}/artifacts"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking release prerequisites..."
    
    # Check if we're on main branch
    local current_branch=$(git branch --show-current)
    if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
        log_error "Releases must be created from main/master branch. Current branch: $current_branch"
        exit 1
    fi
    
    # Check for uncommitted changes
    if [[ -n "$(git status --porcelain)" ]]; then
        log_error "There are uncommitted changes. Please commit or stash them before releasing."
        exit 1
    fi
    
    # Check if we're up to date with remote
    git fetch origin
    local local_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master)
    
    if [[ "$local_commit" != "$remote_commit" ]]; then
        log_error "Local branch is not up to date with remote. Please pull latest changes."
        exit 1
    fi
    
    # Check required tools
    if ! command -v jq &> /dev/null; then
        log_error "jq is required for JSON processing. Please install it."
        exit 1
    fi
    
    if ! command -v gh &> /dev/null; then
        log_warning "GitHub CLI (gh) is not installed. GitHub release creation will be skipped."
    fi
    
    log_success "Prerequisites check passed"
}

# Get current version
get_current_version() {
    jq -r '.version' package.json
}

# Calculate next version
calculate_next_version() {
    local current_version=$1
    local release_type=$2
    
    # If release_type is a specific version (starts with digit), use it
    if [[ "$release_type" =~ ^[0-9] ]]; then
        echo "$release_type"
        return
    fi
    
    # Parse semantic version
    local major minor patch
    IFS='.' read -r major minor patch <<< "$current_version"
    
    case "$release_type" in
        major)
            echo "$((major + 1)).0.0"
            ;;
        minor)
            echo "${major}.$((minor + 1)).0"
            ;;
        patch)
            echo "${major}.${minor}.$((patch + 1))"
            ;;
        *)
            log_error "Invalid release type: $release_type. Use major, minor, patch, or specific version."
            exit 1
            ;;
    esac
}

# Update package versions
update_package_versions() {
    local new_version=$1
    
    log_info "Updating package versions to $new_version..."
    
    # Update root package.json
    jq ".version = \"$new_version\"" package.json > package.json.tmp && mv package.json.tmp package.json
    
    # Update all workspace packages
    local packages=(
        "packages/shared/package.json"
        "packages/config/package.json"
        "apps/backend/package.json"
        "apps/frontend/package.json"
        "apps/n8n-node/package.json"
    )
    
    for package_file in "${packages[@]}"; do
        if [[ -f "$package_file" ]]; then
            jq ".version = \"$new_version\"" "$package_file" > "$package_file.tmp" && mv "$package_file.tmp" "$package_file"
            log_info "Updated $package_file"
        fi
    done
    
    log_success "Package versions updated"
}

# Generate changelog
generate_changelog() {
    local new_version=$1
    local previous_version=$2
    
    log_info "Generating changelog for version $new_version..."
    
    local changelog_file="CHANGELOG.md"
    local temp_changelog="CHANGELOG.tmp"
    
    # Create changelog header
    cat > "$temp_changelog" << EOF
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [$new_version] - $(date +%Y-%m-%d)

### Added
EOF
    
    # Get commits since last tag
    local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    local commit_range
    
    if [[ -n "$last_tag" ]]; then
        commit_range="${last_tag}..HEAD"
    else
        commit_range="HEAD"
    fi
    
    # Parse commits and categorize
    local added_items=()
    local changed_items=()
    local fixed_items=()
    local removed_items=()
    
    while IFS= read -r commit; do
        local message=$(echo "$commit" | cut -d' ' -f2-)
        local type=$(echo "$message" | grep -oE '^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)' || echo "")
        
        case "$type" in
            feat)
                added_items+=("- $message")
                ;;
            fix)
                fixed_items+=("- $message")
                ;;
            refactor|perf)
                changed_items+=("- $message")
                ;;
            *)
                changed_items+=("- $message")
                ;;
        esac
    done < <(git log --oneline "$commit_range")
    
    # Add items to changelog
    if [[ ${#added_items[@]} -gt 0 ]]; then
        printf '%s\n' "${added_items[@]}" >> "$temp_changelog"
    else
        echo "- No new features in this release" >> "$temp_changelog"
    fi
    
    echo "" >> "$temp_changelog"
    echo "### Changed" >> "$temp_changelog"
    if [[ ${#changed_items[@]} -gt 0 ]]; then
        printf '%s\n' "${changed_items[@]}" >> "$temp_changelog"
    else
        echo "- No changes in this release" >> "$temp_changelog"
    fi
    
    echo "" >> "$temp_changelog"
    echo "### Fixed" >> "$temp_changelog"
    if [[ ${#fixed_items[@]} -gt 0 ]]; then
        printf '%s\n' "${fixed_items[@]}" >> "$temp_changelog"
    else
        echo "- No fixes in this release" >> "$temp_changelog"
    fi
    
    # Append existing changelog if it exists
    if [[ -f "$changelog_file" ]]; then
        echo "" >> "$temp_changelog"
        tail -n +3 "$changelog_file" >> "$temp_changelog"
    fi
    
    mv "$temp_changelog" "$changelog_file"
    
    log_success "Changelog generated"
}

# Create git tag
create_git_tag() {
    local version=$1
    
    log_info "Creating git tag v$version..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would create tag v$version"
        return
    fi
    
    # Commit version changes
    git add .
    git commit -m "chore: bump version to $version"
    
    # Create annotated tag
    git tag -a "v$version" -m "Release version $version"
    
    log_success "Git tag v$version created"
}

# Build release artifacts
build_release_artifacts() {
    local version=$1
    
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_warning "Skipping build"
        return
    fi
    
    log_info "Building release artifacts..."
    
    # Set build environment variables
    export BUILD_ENV=production
    export BUILD_VERSION="$version"
    export SKIP_TESTS="$SKIP_TESTS"
    
    # Run build script
    ./scripts/build.sh
    
    log_success "Release artifacts built"
}

# Create GitHub release
create_github_release() {
    local version=$1
    
    if ! command -v gh &> /dev/null; then
        log_warning "GitHub CLI not available, skipping GitHub release"
        return
    fi
    
    log_info "Creating GitHub release..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would create GitHub release v$version"
        return
    fi
    
    # Extract changelog for this version
    local release_notes=$(awk "/## \[$version\]/,/## \[/{if(/## \[/ && !/## \[$version\]/) exit; print}" CHANGELOG.md | tail -n +2)
    
    # Create release
    gh release create "v$version" \
        --title "Release v$version" \
        --notes "$release_notes" \
        --draft=false \
        --prerelease=false
    
    # Upload artifacts if they exist
    if [[ -d "$ARTIFACTS_DIR" ]]; then
        find "$ARTIFACTS_DIR" -name "*.tar.gz" -exec gh release upload "v$version" {} \;
        gh release upload "v$version" "$ARTIFACTS_DIR/checksums.sha256"
    fi
    
    log_success "GitHub release created"
}

# Push changes
push_changes() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN: Would push changes to remote"
        return
    fi
    
    log_info "Pushing changes to remote..."
    
    git push origin main
    git push origin --tags
    
    log_success "Changes pushed to remote"
}

# Main release function
main() {
    local start_time=$(date +%s)
    
    log_info "=== N8N StreamDeck Release Process ==="
    log_info "Release type: $RELEASE_TYPE"
    log_info "Dry run: $DRY_RUN"
    log_info "Skip build: $SKIP_BUILD"
    log_info "Skip tests: $SKIP_TESTS"
    log_info "======================================"
    
    cd "$ROOT_DIR"
    
    check_prerequisites
    
    local current_version=$(get_current_version)
    local new_version=$(calculate_next_version "$current_version" "$RELEASE_TYPE")
    
    log_info "Current version: $current_version"
    log_info "New version: $new_version"
    
    # Confirm release
    if [[ "$DRY_RUN" != "true" ]]; then
        read -p "Proceed with release v$new_version? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Release cancelled"
            exit 0
        fi
    fi
    
    update_package_versions "$new_version"
    generate_changelog "$new_version" "$current_version"
    create_git_tag "$new_version"
    build_release_artifacts "$new_version"
    push_changes
    create_github_release "$new_version"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Release v$new_version completed successfully in ${duration}s"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        log_info "Release URL: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/releases/tag/v$new_version"
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [major|minor|patch|VERSION]"
    echo ""
    echo "Environment variables:"
    echo "  DRY_RUN=true        - Show what would be done without making changes"
    echo "  SKIP_BUILD=true     - Skip building release artifacts"
    echo "  SKIP_TESTS=true     - Skip running tests during build"
    echo ""
    echo "Examples:"
    echo "  $0 patch            - Create a patch release (1.0.0 -> 1.0.1)"
    echo "  $0 minor            - Create a minor release (1.0.0 -> 1.1.0)"
    echo "  $0 major            - Create a major release (1.0.0 -> 2.0.0)"
    echo "  $0 1.2.3            - Create a specific version release"
    echo "  DRY_RUN=true $0 patch - Preview what would happen"
}

# Handle help flag
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Run main function
main "$@"