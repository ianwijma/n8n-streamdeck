#!/bin/bash

# N8N StreamDeck Build Script
# Orchestrates the build process for the entire monorepo

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUILD_ENV=${BUILD_ENV:-production}
BUILD_VERSION=${BUILD_VERSION:-$(git describe --tags --always --dirty)}
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUILD_COMMIT=${GITHUB_SHA:-$(git rev-parse HEAD)}
SKIP_TESTS=${SKIP_TESTS:-false}
SKIP_LINT=${SKIP_LINT:-false}
PARALLEL_BUILDS=${PARALLEL_BUILDS:-true}
OPTIMIZE_ASSETS=${OPTIMIZE_ASSETS:-true}

# Directories
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
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

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Add cleanup logic here if needed
}

# Error handler
error_handler() {
    local line_number=$1
    log_error "Build failed at line $line_number"
    cleanup
    exit 1
}

# Set error trap
trap 'error_handler $LINENO' ERR
trap cleanup EXIT

# Print build information
print_build_info() {
    log_info "=== N8N StreamDeck Build Information ==="
    log_info "Environment: $BUILD_ENV"
    log_info "Version: $BUILD_VERSION"
    log_info "Date: $BUILD_DATE"
    log_info "Commit: $BUILD_COMMIT"
    log_info "Skip Tests: $SKIP_TESTS"
    log_info "Skip Lint: $SKIP_LINT"
    log_info "Parallel Builds: $PARALLEL_BUILDS"
    log_info "Optimize Assets: $OPTIMIZE_ASSETS"
    log_info "========================================"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    
    if ! npx semver -r ">=$required_version" "$node_version" &> /dev/null; then
        log_error "Node.js version $node_version is not supported. Required: >=$required_version"
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install it with: npm install -g pnpm"
        exit 1
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        log_info "Docker is available"
    else
        log_warning "Docker is not available. Docker builds will be skipped."
    fi
    
    log_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$ROOT_DIR"
    
    # Clean install
    if [[ -d "node_modules" ]]; then
        log_info "Cleaning existing node_modules..."
        rm -rf node_modules
    fi
    
    # Install with frozen lockfile
    pnpm install --frozen-lockfile
    
    log_success "Dependencies installed"
}

# Lint code
lint_code() {
    if [[ "$SKIP_LINT" == "true" ]]; then
        log_warning "Skipping linting"
        return 0
    fi
    
    log_info "Linting code..."
    
    cd "$ROOT_DIR"
    
    # Run ESLint
    if [[ -f ".eslintrc.js" ]]; then
        pnpm run lint || {
            log_error "Linting failed"
            return 1
        }
    fi
    
    # Run Prettier check
    if [[ -f ".prettierrc" ]]; then
        pnpm run format:check || {
            log_error "Code formatting check failed"
            return 1
        }
    fi
    
    log_success "Linting passed"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping tests"
        return 0
    fi
    
    log_info "Running tests..."
    
    cd "$ROOT_DIR"
    
    # Unit tests
    log_info "Running unit tests..."
    pnpm run test:unit || {
        log_error "Unit tests failed"
        return 1
    }
    
    # Integration tests
    log_info "Running integration tests..."
    pnpm run test:integration || {
        log_error "Integration tests failed"
        return 1
    }
    
    log_success "All tests passed"
}

# Build shared packages
build_shared_packages() {
    log_info "Building shared packages..."
    
    cd "$ROOT_DIR"
    
    # Build in dependency order
    local packages=("@n8n-streamdeck/config" "@n8n-streamdeck/shared")
    
    for package in "${packages[@]}"; do
        log_info "Building $package..."
        pnpm --filter "$package" build
        log_success "$package built successfully"
    done
}

# Build applications
build_applications() {
    log_info "Building applications..."
    
    cd "$ROOT_DIR"
    
    if [[ "$PARALLEL_BUILDS" == "true" ]]; then
        log_info "Building applications in parallel..."
        
        # Build backend and frontend in parallel
        (
            log_info "Building backend..."
            pnpm --filter @n8n-streamdeck/backend build
            log_success "Backend built successfully"
        ) &
        
        (
            log_info "Building frontend..."
            pnpm --filter @n8n-streamdeck/frontend build
            log_success "Frontend built successfully"
        ) &
        
        # Wait for both builds to complete
        wait
    else
        log_info "Building applications sequentially..."
        
        # Build backend
        log_info "Building backend..."
        pnpm --filter @n8n-streamdeck/backend build
        log_success "Backend built successfully"
        
        # Build frontend
        log_info "Building frontend..."
        pnpm --filter @n8n-streamdeck/frontend build
        log_success "Frontend built successfully"
    fi
    
    # Build N8N node
    log_info "Building N8N node..."
    pnpm --filter @n8n-streamdeck/n8n-node build
    log_success "N8N node built successfully"
}

# Optimize assets
optimize_assets() {
    if [[ "$OPTIMIZE_ASSETS" != "true" ]]; then
        log_warning "Skipping asset optimization"
        return 0
    fi
    
    log_info "Optimizing assets..."
    
    # Compress JavaScript and CSS files
    find "$ROOT_DIR" -name "*.js" -o -name "*.css" | while read -r file; do
        if command -v gzip &> /dev/null; then
            gzip -k -f "$file"
        fi
    done
    
    # Optimize images (if tools are available)
    if command -v optipng &> /dev/null; then
        find "$ROOT_DIR" -name "*.png" -exec optipng -o2 {} \;
    fi
    
    if command -v jpegoptim &> /dev/null; then
        find "$ROOT_DIR" -name "*.jpg" -o -name "*.jpeg" -exec jpegoptim --strip-all {} \;
    fi
    
    log_success "Assets optimized"
}

# Generate build metadata
generate_build_metadata() {
    log_info "Generating build metadata..."
    
    mkdir -p "$ARTIFACTS_DIR"
    
    cat > "$ARTIFACTS_DIR/build-info.json" << EOF
{
  "version": "$BUILD_VERSION",
  "environment": "$BUILD_ENV",
  "buildDate": "$BUILD_DATE",
  "commit": "$BUILD_COMMIT",
  "nodeVersion": "$(node --version)",
  "pnpmVersion": "$(pnpm --version)",
  "platform": "$(uname -s)",
  "architecture": "$(uname -m)"
}
EOF
    
    log_success "Build metadata generated"
}

# Create distribution packages
create_distribution() {
    log_info "Creating distribution packages..."
    
    mkdir -p "$DIST_DIR"
    
    # Copy built applications
    cp -r apps/backend/dist "$DIST_DIR/backend"
    cp -r apps/frontend/.next "$DIST_DIR/frontend"
    cp -r apps/n8n-node/dist "$DIST_DIR/n8n-node"
    
    # Copy package.json files
    cp apps/backend/package.json "$DIST_DIR/backend/"
    cp apps/frontend/package.json "$DIST_DIR/frontend/"
    cp apps/n8n-node/package.json "$DIST_DIR/n8n-node/"
    
    # Copy shared packages
    mkdir -p "$DIST_DIR/packages"
    cp -r packages/shared/dist "$DIST_DIR/packages/shared"
    cp -r packages/config/dist "$DIST_DIR/packages/config"
    cp packages/shared/package.json "$DIST_DIR/packages/shared/"
    cp packages/config/package.json "$DIST_DIR/packages/config/"
    
    # Copy configuration files
    cp package.json "$DIST_DIR/"
    cp pnpm-workspace.yaml "$DIST_DIR/"
    
    # Create tarball
    cd "$DIST_DIR"
    tar -czf "$ARTIFACTS_DIR/n8n-streamdeck-$BUILD_VERSION.tar.gz" .
    
    log_success "Distribution packages created"
}

# Build Docker images
build_docker_images() {
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not available, skipping Docker builds"
        return 0
    fi
    
    log_info "Building Docker images..."
    
    cd "$ROOT_DIR"
    
    # Build backend image
    log_info "Building backend Docker image..."
    docker build -f apps/backend/Dockerfile -t "n8n-streamdeck-backend:$BUILD_VERSION" .
    docker tag "n8n-streamdeck-backend:$BUILD_VERSION" "n8n-streamdeck-backend:latest"
    
    # Build frontend image
    log_info "Building frontend Docker image..."
    docker build -f apps/frontend/Dockerfile -t "n8n-streamdeck-frontend:$BUILD_VERSION" .
    docker tag "n8n-streamdeck-frontend:$BUILD_VERSION" "n8n-streamdeck-frontend:latest"
    
    # Save images as tarballs
    docker save "n8n-streamdeck-backend:$BUILD_VERSION" | gzip > "$ARTIFACTS_DIR/backend-$BUILD_VERSION.tar.gz"
    docker save "n8n-streamdeck-frontend:$BUILD_VERSION" | gzip > "$ARTIFACTS_DIR/frontend-$BUILD_VERSION.tar.gz"
    
    log_success "Docker images built and saved"
}

# Generate checksums
generate_checksums() {
    log_info "Generating checksums..."
    
    cd "$ARTIFACTS_DIR"
    
    # Generate SHA256 checksums for all artifacts
    find . -type f -name "*.tar.gz" -exec sha256sum {} \; > checksums.sha256
    
    log_success "Checksums generated"
}

# Main build function
main() {
    local start_time=$(date +%s)
    
    print_build_info
    check_prerequisites
    install_dependencies
    lint_code
    run_tests
    build_shared_packages
    build_applications
    optimize_assets
    generate_build_metadata
    create_distribution
    build_docker_images
    generate_checksums
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Build completed successfully in ${duration}s"
    log_info "Artifacts available in: $ARTIFACTS_DIR"
    log_info "Distribution available in: $DIST_DIR"
}

# Run main function
main "$@"