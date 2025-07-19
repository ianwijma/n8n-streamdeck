#!/bin/bash

# N8N StreamDeck Rollback Script
# Handles rollback to previous deployment version

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
ROLLBACK_VERSION=${2:-}
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

# List available backups
list_backups() {
    log_info "Available backups:"
    
    ssh_exec "
        cd $DEPLOY_DIR
        if [[ -d backups ]]; then
            ls -la backups/ | grep '^d' | awk '{print \$9, \$6, \$7, \$8}' | grep -v '^\.$\|^\.\.$'
        else
            echo 'No backups directory found'
        fi
    "
}

# Get latest backup
get_latest_backup() {
    ssh_exec "
        cd $DEPLOY_DIR
        if [[ -d backups ]]; then
            ls -t backups/ | head -n 1
        fi
    "
}

# Validate backup
validate_backup() {
    local backup_name="$1"
    
    log_info "Validating backup: $backup_name"
    
    local validation_result=$(ssh_exec "
        cd $DEPLOY_DIR
        if [[ -d \"backups/$backup_name\" ]]; then
            echo 'valid'
        else
            echo 'invalid'
        fi
    ")
    
    if [[ "$validation_result" != "valid" ]]; then
        log_error "Backup $backup_name is not valid or does not exist"
        return 1
    fi
    
    log_success "Backup validation passed"
}

# Create pre-rollback backup
create_pre_rollback_backup() {
    log_info "Creating pre-rollback backup..."
    
    ssh_exec "
        cd $DEPLOY_DIR
        
        # Create backup directory
        BACKUP_DIR=\"backups/pre-rollback-\$(date +%Y%m%d-%H%M%S)\"
        mkdir -p \"\$BACKUP_DIR\"
        
        # Backup database if running
        if docker-compose -f $COMPOSE_FILE ps postgres | grep -q Up; then
            docker-compose -f $COMPOSE_FILE exec -T postgres pg_dump -U n8n_streamdeck n8n_streamdeck_prod > \"\$BACKUP_DIR/database.sql\" || true
        fi
        
        # Backup volumes
        docker run --rm -v n8n-streamdeck-backend-data:/data -v \$(pwd)/\$BACKUP_DIR:/backup alpine tar czf /backup/backend-data.tar.gz -C /data . || true
        docker run --rm -v n8n-streamdeck-redis-data:/data -v \$(pwd)/\$BACKUP_DIR:/backup alpine tar czf /backup/redis-data.tar.gz -C /data . || true
        
        echo \"Pre-rollback backup created: \$BACKUP_DIR\"
    "
    
    log_success "Pre-rollback backup created"
}

# Stop current services
stop_services() {
    log_info "Stopping current services..."
    
    ssh_exec "
        cd $DEPLOY_DIR
        docker-compose -f $COMPOSE_FILE down --remove-orphans
    "
    
    log_success "Services stopped"
}

# Restore data from backup
restore_data() {
    local backup_name="$1"
    
    log_info "Restoring data from backup: $backup_name"
    
    ssh_exec "
        cd $DEPLOY_DIR
        
        # Restore backend data
        if [[ -f \"backups/$backup_name/backend-data.tar.gz\" ]]; then
            docker run --rm -v n8n-streamdeck-backend-data:/data -v \$(pwd)/backups/$backup_name:/backup alpine tar xzf /backup/backend-data.tar.gz -C /data
            echo 'Backend data restored'
        fi
        
        # Restore Redis data
        if [[ -f \"backups/$backup_name/redis-data.tar.gz\" ]]; then
            docker run --rm -v n8n-streamdeck-redis-data:/data -v \$(pwd)/backups/$backup_name:/backup alpine tar xzf /backup/redis-data.tar.gz -C /data
            echo 'Redis data restored'
        fi
    "
    
    log_success "Data restoration completed"
}

# Restore database
restore_database() {
    local backup_name="$1"
    
    log_info "Restoring database from backup: $backup_name"
    
    ssh_exec "
        cd $DEPLOY_DIR
        
        if [[ -f \"backups/$backup_name/database.sql\" ]]; then
            # Start only PostgreSQL
            docker-compose -f $COMPOSE_FILE up -d postgres
            
            # Wait for PostgreSQL to be ready
            sleep 15
            
            # Drop and recreate database
            docker-compose -f $COMPOSE_FILE exec -T postgres psql -U n8n_streamdeck -d postgres -c 'DROP DATABASE IF EXISTS n8n_streamdeck_prod;'
            docker-compose -f $COMPOSE_FILE exec -T postgres psql -U n8n_streamdeck -d postgres -c 'CREATE DATABASE n8n_streamdeck_prod;'
            
            # Restore database
            docker-compose -f $COMPOSE_FILE exec -T postgres psql -U n8n_streamdeck -d n8n_streamdeck_prod < \"backups/$backup_name/database.sql\"
            
            echo 'Database restored successfully'
        else
            echo 'No database backup found, skipping database restore'
        fi
    "
    
    log_success "Database restoration completed"
}

# Get Docker image tag from backup
get_backup_image_tag() {
    local backup_name="$1"
    
    ssh_exec "
        cd $DEPLOY_DIR
        if [[ -f \"backups/$backup_name/deployment.log\" ]]; then
            grep 'Version:' \"backups/$backup_name/deployment.log\" | tail -n 1 | cut -d' ' -f2
        else
            echo 'latest'
        fi
    "
}

# Update environment file for rollback
update_environment() {
    local image_tag="$1"
    
    log_info "Updating environment for rollback to version: $image_tag"
    
    ssh_exec "
        cd $DEPLOY_DIR
        
        # Update IMAGE_TAG in .env file
        if [[ -f .env ]]; then
            sed -i \"s/^IMAGE_TAG=.*/IMAGE_TAG=$image_tag/\" .env
        else
            echo \"IMAGE_TAG=$image_tag\" > .env
        fi
    "
    
    log_success "Environment updated"
}

# Pull rollback images
pull_rollback_images() {
    local image_tag="$1"
    
    log_info "Pulling Docker images for version: $image_tag"
    
    ssh_exec "
        cd $DEPLOY_DIR
        
        # Pull specific version images
        docker pull ghcr.io/ianwijma/n8n-streamdeck-backend:$image_tag || docker pull n8n-streamdeck-backend:$image_tag
        docker pull ghcr.io/ianwijma/n8n-streamdeck-frontend:$image_tag || docker pull n8n-streamdeck-frontend:$image_tag
        
        # Tag as latest for docker-compose
        docker tag ghcr.io/ianwijma/n8n-streamdeck-backend:$image_tag n8n-streamdeck-backend:latest || true
        docker tag ghcr.io/ianwijma/n8n-streamdeck-frontend:$image_tag n8n-streamdeck-frontend:latest || true
    "
    
    log_success "Rollback images pulled"
}

# Start services
start_services() {
    log_info "Starting services..."
    
    ssh_exec "
        cd $DEPLOY_DIR
        docker-compose -f $COMPOSE_FILE up -d
    "
    
    log_success "Services started"
}

# Health check
health_check() {
    log_info "Performing health checks..."
    
    local retries=0
    local max_retries=30
    
    while [[ $retries -lt $max_retries ]]; do
        log_info "Health check attempt $((retries + 1))/$max_retries"
        
        if ssh_exec "curl -f http://localhost/health" && ssh_exec "curl -f http://localhost/api/health"; then
            log_success "Health checks passed"
            return 0
        fi
        
        retries=$((retries + 1))
        sleep 10
    done
    
    log_error "Health checks failed after $max_retries attempts"
    return 1
}

# Update rollback log
update_rollback_log() {
    local backup_name="$1"
    local image_tag="$2"
    
    ssh_exec "
        cd $DEPLOY_DIR
        echo \"Rollback completed: \$(date)\" >> rollback.log
        echo \"Rolled back to backup: $backup_name\" >> rollback.log
        echo \"Version: $image_tag\" >> rollback.log
        echo \"Environment: $ENVIRONMENT\" >> rollback.log
        echo \"---\" >> rollback.log
    "
}

# Interactive backup selection
select_backup_interactive() {
    log_info "Available backups:"
    
    local backups=($(ssh_exec "cd $DEPLOY_DIR && ls -t backups/ 2>/dev/null || true"))
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        log_error "No backups available for rollback"
        exit 1
    fi
    
    echo "Select a backup to rollback to:"
    for i in "${!backups[@]}"; do
        echo "$((i+1)). ${backups[i]}"
    done
    
    read -p "Enter backup number (1-${#backups[@]}): " selection
    
    if [[ "$selection" -ge 1 && "$selection" -le ${#backups[@]} ]]; then
        echo "${backups[$((selection-1))]}"
    else
        log_error "Invalid selection"
        exit 1
    fi
}

# Main rollback function
main() {
    local start_time=$(date +%s)
    
    log_info "=== N8N StreamDeck Rollback ==="
    log_info "Environment: $ENVIRONMENT"
    log_info "Host: $DEPLOY_HOST"
    log_info "=========================="
    
    # Determine backup to use
    local backup_name
    if [[ -n "$ROLLBACK_VERSION" ]]; then
        # Use specified version/backup
        backup_name="$ROLLBACK_VERSION"
    else
        # Interactive selection or latest
        if [[ -t 0 ]]; then
            backup_name=$(select_backup_interactive)
        else
            backup_name=$(get_latest_backup)
            if [[ -z "$backup_name" ]]; then
                log_error "No backups available for rollback"
                exit 1
            fi
        fi
    fi
    
    log_info "Selected backup: $backup_name"
    
    # Validate backup
    if ! validate_backup "$backup_name"; then
        exit 1
    fi
    
    # Get image tag from backup
    local image_tag=$(get_backup_image_tag "$backup_name")
    log_info "Rollback image tag: $image_tag"
    
    # Confirm rollback
    if [[ -t 0 ]]; then
        read -p "Proceed with rollback to $backup_name? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Rollback cancelled"
            exit 0
        fi
    fi
    
    # Execute rollback
    create_pre_rollback_backup
    stop_services
    restore_data "$backup_name"
    restore_database "$backup_name"
    update_environment "$image_tag"
    pull_rollback_images "$image_tag"
    start_services
    
    # Verify rollback
    if ! health_check; then
        log_error "Rollback verification failed"
        exit 1
    fi
    
    update_rollback_log "$backup_name" "$image_tag"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Rollback completed successfully in ${duration}s"
    log_info "Application URL: https://$DOMAIN"
    log_info "Rolled back to backup: $backup_name"
    log_info "Version: $image_tag"
}

# Show usage
usage() {
    echo "Usage: $0 [staging|production] [backup-name]"
    echo ""
    echo "Arguments:"
    echo "  environment    - Target environment (staging or production)"
    echo "  backup-name    - Specific backup to rollback to (optional)"
    echo ""
    echo "Environment variables:"
    echo "  STAGING_HOST           - Staging server hostname"
    echo "  STAGING_USER           - SSH user for staging server"
    echo "  STAGING_SSH_KEY        - SSH private key for staging server"
    echo "  PRODUCTION_HOST        - Production server hostname"
    echo "  PRODUCTION_USER        - SSH user for production server"
    echo "  PRODUCTION_SSH_KEY     - SSH private key for production server"
    echo ""
    echo "Examples:"
    echo "  $0 production                    - Interactive rollback to latest backup"
    echo "  $0 production backup-20240101    - Rollback to specific backup"
    echo "  $0 staging                       - Rollback staging environment"
}

# Handle help flag
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Handle list backups
if [[ "${1:-}" == "list" ]]; then
    ENVIRONMENT=${2:-production}
    list_backups
    exit 0
fi

# Run main function
main "$@"