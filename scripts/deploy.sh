#!/bin/bash

# N8N StreamDeck Deployment Script
# Handles zero-downtime deployment to staging and production environments

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
IMAGE_TAG=${IMAGE_TAG:-latest}
DEPLOY_TIMEOUT=${DEPLOY_TIMEOUT:-300}
HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-30}
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-10}

# Directories
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="/opt/n8n-streamdeck"

# Environment-specific configuration
case "$ENVIRONMENT" in
    staging)
        DEPLOY_HOST=${STAGING_HOST:-staging.n8n-streamdeck.example.com}
        DEPLOY_USER=${STAGING_USER:-deploy}
        SSH_KEY=${STAGING_SSH_KEY:-}
        COMPOSE_FILE="docker-compose.staging.yml"
        DOMAIN="staging.n8n-streamdeck.example.com"
        ;;
    production)
        DEPLOY_HOST=${PRODUCTION_HOST:-n8n-streamdeck.example.com}
        DEPLOY_USER=${PRODUCTION_USER:-deploy}
        SSH_KEY=${PRODUCTION_SSH_KEY:-}
        COMPOSE_FILE="docker-compose.prod.yml"
        DOMAIN="n8n-streamdeck.example.com"
        ;;
    *)
        echo "Invalid environment: $ENVIRONMENT. Use 'staging' or 'production'"
        exit 1
        ;;
esac

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

# SSH command wrapper
ssh_exec() {
    local command="$1"
    
    if [[ -n "$SSH_KEY" ]]; then
        ssh -i <(echo "$SSH_KEY") -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" "$command"
    else
        ssh -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" "$command"
    fi
}

# SCP file transfer wrapper
scp_file() {
    local source="$1"
    local destination="$2"
    
    if [[ -n "$SSH_KEY" ]]; then
        scp -i <(echo "$SSH_KEY") -o StrictHostKeyChecking=no "$source" "$DEPLOY_USER@$DEPLOY_HOST:$destination"
    else
        scp -o StrictHostKeyChecking=no "$source" "$DEPLOY_USER@$DEPLOY_HOST:$destination"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."
    
    # Check required environment variables
    if [[ -z "$DEPLOY_HOST" ]]; then
        log_error "DEPLOY_HOST is not set"
        exit 1
    fi
    
    if [[ -z "$DEPLOY_USER" ]]; then
        log_error "DEPLOY_USER is not set"
        exit 1
    fi
    
    # Test SSH connection
    if ! ssh_exec "echo 'SSH connection successful'"; then
        log_error "Failed to establish SSH connection to $DEPLOY_HOST"
        exit 1
    fi
    
    # Check Docker on remote host
    if ! ssh_exec "docker --version"; then
        log_error "Docker is not installed on the remote host"
        exit 1
    fi
    
    # Check Docker Compose on remote host
    if ! ssh_exec "docker-compose --version"; then
        log_error "Docker Compose is not installed on the remote host"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Setup deployment directory
setup_deployment_directory() {
    log_info "Setting up deployment directory..."
    
    ssh_exec "
        sudo mkdir -p $DEPLOY_DIR
        sudo chown $DEPLOY_USER:$DEPLOY_USER $DEPLOY_DIR
        cd $DEPLOY_DIR
        mkdir -p {config,data,logs,backups,ssl}
    "
    
    log_success "Deployment directory setup complete"
}

# Transfer deployment files
transfer_files() {
    log_info "Transferring deployment files..."
    
    # Create temporary directory for deployment files
    local temp_dir=$(mktemp -d)
    
    # Copy necessary files
    cp "$ROOT_DIR/$COMPOSE_FILE" "$temp_dir/"
    cp "$ROOT_DIR/nginx/nginx.prod.conf" "$temp_dir/"
    cp -r "$ROOT_DIR/nginx/conf.d" "$temp_dir/" 2>/dev/null || true
    cp -r "$ROOT_DIR/monitoring" "$temp_dir/" 2>/dev/null || true
    cp -r "$ROOT_DIR/scripts" "$temp_dir/"
    
    # Create environment file
    cat > "$temp_dir/.env" << EOF
DOMAIN=$DOMAIN
IMAGE_TAG=$IMAGE_TAG
DB_PASSWORD=${DB_PASSWORD:-$(openssl rand -base64 32)}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 64)}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-$(openssl rand -base64 32)}
GRAFANA_PASSWORD=${GRAFANA_PASSWORD:-$(openssl rand -base64 16)}
N8N_BASE_URL=${N8N_BASE_URL:-}
N8N_API_KEY=${N8N_API_KEY:-}
EOF
    
    # Transfer files to remote host
    scp_file "$temp_dir/*" "$DEPLOY_DIR/"
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log_success "Files transferred successfully"
}

# Login to Docker registry
docker_login() {
    log_info "Logging into Docker registry..."
    
    if [[ -n "${DOCKER_REGISTRY_TOKEN:-}" ]]; then
        ssh_exec "echo '$DOCKER_REGISTRY_TOKEN' | docker login ghcr.io -u '$GITHUB_ACTOR' --password-stdin"
    else
        log_warning "No Docker registry token provided, assuming images are already available"
    fi
}

# Pull Docker images
pull_images() {
    log_info "Pulling Docker images..."
    
    ssh_exec "
        cd $DEPLOY_DIR
        docker-compose -f $COMPOSE_FILE pull
    "
    
    log_success "Docker images pulled successfully"
}

# Backup current deployment
backup_current_deployment() {
    log_info "Creating backup of current deployment..."
    
    ssh_exec "
        cd $DEPLOY_DIR
        
        # Create backup directory
        BACKUP_DIR=\"backups/backup-\$(date +%Y%m%d-%H%M%S)\"
        mkdir -p \"\$BACKUP_DIR\"
        
        # Backup database if running
        if docker-compose -f $COMPOSE_FILE ps postgres | grep -q Up; then
            docker-compose -f $COMPOSE_FILE exec -T postgres pg_dump -U n8n_streamdeck n8n_streamdeck_prod > \"\$BACKUP_DIR/database.sql\"
        fi
        
        # Backup volumes
        docker run --rm -v n8n-streamdeck-backend-data:/data -v \$(pwd)/\$BACKUP_DIR:/backup alpine tar czf /backup/backend-data.tar.gz -C /data .
        docker run --rm -v n8n-streamdeck-redis-data:/data -v \$(pwd)/\$BACKUP_DIR:/backup alpine tar czf /backup/redis-data.tar.gz -C /data .
        
        # Keep only last 5 backups
        ls -t backups/ | tail -n +6 | xargs -r rm -rf
    "
    
    log_success "Backup created successfully"
}

# Deploy with zero downtime
deploy_zero_downtime() {
    log_info "Starting zero-downtime deployment..."
    
    ssh_exec "
        cd $DEPLOY_DIR
        
        # Scale up new instances
        docker-compose -f $COMPOSE_FILE up -d --scale backend=4 --scale frontend=4 --no-recreate
        
        # Wait for new instances to be healthy
        sleep 30
        
        # Check health of new instances
        for i in {1..10}; do
            if docker-compose -f $COMPOSE_FILE exec -T nginx nginx -t; then
                break
            fi
            sleep 5
        done
        
        # Reload nginx to pick up new instances
        docker-compose -f $COMPOSE_FILE exec -T nginx nginx -s reload
        
        # Scale down to normal capacity
        sleep 10
        docker-compose -f $COMPOSE_FILE up -d --scale backend=2 --scale frontend=2
    "
    
    log_success "Zero-downtime deployment completed"
}

# Standard deployment (for initial deployment)
deploy_standard() {
    log_info "Starting standard deployment..."
    
    ssh_exec "
        cd $DEPLOY_DIR
        
        # Stop existing services
        docker-compose -f $COMPOSE_FILE down --remove-orphans
        
        # Start services
        docker-compose -f $COMPOSE_FILE up -d
        
        # Wait for services to start
        sleep 30
    "
    
    log_success "Standard deployment completed"
}

# Health check
health_check() {
    log_info "Performing health checks..."
    
    local retries=0
    local max_retries=$HEALTH_CHECK_RETRIES
    
    while [[ $retries -lt $max_retries ]]; do
        log_info "Health check attempt $((retries + 1))/$max_retries"
        
        # Check if services are responding
        if ssh_exec "curl -f http://localhost/health" && ssh_exec "curl -f http://localhost/api/health"; then
            log_success "Health checks passed"
            return 0
        fi
        
        retries=$((retries + 1))
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "Health checks failed after $max_retries attempts"
    return 1
}

# Run post-deployment tasks
post_deployment_tasks() {
    log_info "Running post-deployment tasks..."
    
    ssh_exec "
        cd $DEPLOY_DIR
        
        # Run database migrations if needed
        if [[ -f scripts/migrate.sh ]]; then
            ./scripts/migrate.sh
        fi
        
        # Clear application caches
        docker-compose -f $COMPOSE_FILE exec -T redis redis-cli FLUSHDB
        
        # Restart services to ensure clean state
        docker-compose -f $COMPOSE_FILE restart backend frontend
        
        # Update deployment log
        echo \"Deployment completed: \$(date)\" >> deployment.log
        echo \"Version: $IMAGE_TAG\" >> deployment.log
        echo \"Environment: $ENVIRONMENT\" >> deployment.log
    "
    
    log_success "Post-deployment tasks completed"
}

# Rollback deployment
rollback_deployment() {
    log_error "Deployment failed, initiating rollback..."
    
    ssh_exec "
        cd $DEPLOY_DIR
        
        # Find latest backup
        LATEST_BACKUP=\$(ls -t backups/ | head -n 1)
        
        if [[ -n \"\$LATEST_BACKUP\" ]]; then
            echo \"Rolling back to backup: \$LATEST_BACKUP\"
            
            # Stop current services
            docker-compose -f $COMPOSE_FILE down
            
            # Restore data volumes
            docker run --rm -v n8n-streamdeck-backend-data:/data -v \$(pwd)/backups/\$LATEST_BACKUP:/backup alpine tar xzf /backup/backend-data.tar.gz -C /data
            docker run --rm -v n8n-streamdeck-redis-data:/data -v \$(pwd)/backups/\$LATEST_BACKUP:/backup alpine tar xzf /backup/redis-data.tar.gz -C /data
            
            # Restore database
            if [[ -f \"backups/\$LATEST_BACKUP/database.sql\" ]]; then
                docker-compose -f $COMPOSE_FILE up -d postgres
                sleep 10
                docker-compose -f $COMPOSE_FILE exec -T postgres psql -U n8n_streamdeck -d n8n_streamdeck_prod < \"backups/\$LATEST_BACKUP/database.sql\"
            fi
            
            # Start services with previous version
            docker-compose -f $COMPOSE_FILE up -d
            
            echo \"Rollback completed\"
        else
            echo \"No backup found for rollback\"
        fi
    "
}

# Cleanup old resources
cleanup() {
    log_info "Cleaning up old resources..."
    
    ssh_exec "
        # Remove unused Docker images
        docker image prune -f
        
        # Remove unused volumes
        docker volume prune -f
        
        # Remove unused networks
        docker network prune -f
    "
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    log_info "=== N8N StreamDeck Deployment ==="
    log_info "Environment: $ENVIRONMENT"
    log_info "Host: $DEPLOY_HOST"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "================================="
    
    # Set error trap for rollback
    trap rollback_deployment ERR
    
    check_prerequisites
    setup_deployment_directory
    transfer_files
    docker_login
    pull_images
    backup_current_deployment
    
    # Check if this is initial deployment
    if ssh_exec "docker-compose -f $DEPLOY_DIR/$COMPOSE_FILE ps | grep -q Up"; then
        deploy_zero_downtime
    else
        deploy_standard
    fi
    
    # Verify deployment
    if ! health_check; then
        log_error "Deployment verification failed"
        exit 1
    fi
    
    post_deployment_tasks
    cleanup
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Deployment completed successfully in ${duration}s"
    log_info "Application URL: https://$DOMAIN"
    
    # Remove error trap
    trap - ERR
}

# Show usage
usage() {
    echo "Usage: $0 [staging|production]"
    echo ""
    echo "Environment variables:"
    echo "  IMAGE_TAG              - Docker image tag to deploy (default: latest)"
    echo "  DEPLOY_TIMEOUT         - Deployment timeout in seconds (default: 300)"
    echo "  HEALTH_CHECK_RETRIES   - Number of health check retries (default: 30)"
    echo "  HEALTH_CHECK_INTERVAL  - Health check interval in seconds (default: 10)"
    echo ""
    echo "Staging environment variables:"
    echo "  STAGING_HOST           - Staging server hostname"
    echo "  STAGING_USER           - SSH user for staging server"
    echo "  STAGING_SSH_KEY        - SSH private key for staging server"
    echo ""
    echo "Production environment variables:"
    echo "  PRODUCTION_HOST        - Production server hostname"
    echo "  PRODUCTION_USER        - SSH user for production server"
    echo "  PRODUCTION_SSH_KEY     - SSH private key for production server"
    echo ""
    echo "Examples:"
    echo "  $0 staging             - Deploy to staging"
    echo "  $0 production          - Deploy to production"
    echo "  IMAGE_TAG=v1.2.3 $0 production - Deploy specific version to production"
}

# Handle help flag
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Run main function
main "$@"