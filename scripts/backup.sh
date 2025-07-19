#!/bin/bash

# N8N StreamDeck Backup Script
# Creates backups of database and application data

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${BACKUP_ENV:-production}
BACKUP_TYPE=${1:-full}  # full, database, data
RETENTION_DAYS=${RETENTION_DAYS:-30}
BACKUP_DIR="/opt/n8n-streamdeck/backups"

# Database configuration
DB_NAME="n8n_streamdeck_prod"
DB_USER="n8n_streamdeck"
DB_PASSWORD=${DB_PASSWORD:-}

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

# Create backup directory
create_backup_directory() {
    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$backup_path"
    echo "$backup_path"
}

# Backup database
backup_database() {
    local backup_path="$1"
    
    log_info "Backing up database..."
    
    # Check if PostgreSQL container is running
    if ! docker-compose ps postgres | grep -q Up; then
        log_warning "PostgreSQL container is not running, skipping database backup"
        return 0
    fi
    
    # Create database backup
    if docker-compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$backup_path/database.sql"; then
        log_success "Database backup completed"
        
        # Compress database backup
        gzip "$backup_path/database.sql"
        log_info "Database backup compressed"
    else
        log_error "Database backup failed"
        return 1
    fi
}

# Backup application data
backup_data() {
    local backup_path="$1"
    
    log_info "Backing up application data..."
    
    # Backup backend data volume
    if docker run --rm -v n8n-streamdeck-backend-data:/data -v "$backup_path:/backup" alpine tar czf /backup/backend-data.tar.gz -C /data .; then
        log_success "Backend data backup completed"
    else
        log_warning "Backend data backup failed"
    fi
    
    # Backup Redis data volume
    if docker run --rm -v n8n-streamdeck-redis-data:/data -v "$backup_path:/backup" alpine tar czf /backup/redis-data.tar.gz -C /data .; then
        log_success "Redis data backup completed"
    else
        log_warning "Redis data backup failed"
    fi
    
    # Backup configuration files
    if [[ -d "/opt/n8n-streamdeck/config" ]]; then
        tar czf "$backup_path/config.tar.gz" -C /opt/n8n-streamdeck config/
        log_success "Configuration backup completed"
    fi
    
    # Backup SSL certificates
    if [[ -d "/opt/n8n-streamdeck/ssl" ]]; then
        tar czf "$backup_path/ssl.tar.gz" -C /opt/n8n-streamdeck ssl/
        log_success "SSL certificates backup completed"
    fi
}

# Backup logs
backup_logs() {
    local backup_path="$1"
    
    log_info "Backing up logs..."
    
    # Backup application logs
    if docker run --rm -v n8n-streamdeck-backend-logs:/logs -v "$backup_path:/backup" alpine tar czf /backup/backend-logs.tar.gz -C /logs .; then
        log_success "Backend logs backup completed"
    else
        log_warning "Backend logs backup failed"
    fi
    
    if docker run --rm -v n8n-streamdeck-frontend-logs:/logs -v "$backup_path:/backup" alpine tar czf /backup/frontend-logs.tar.gz -C /logs .; then
        log_success "Frontend logs backup completed"
    else
        log_warning "Frontend logs backup failed"
    fi
    
    if docker run --rm -v n8n-streamdeck-nginx-logs:/logs -v "$backup_path:/backup" alpine tar czf /backup/nginx-logs.tar.gz -C /logs .; then
        log_success "Nginx logs backup completed"
    else
        log_warning "Nginx logs backup failed"
    fi
}

# Create backup metadata
create_backup_metadata() {
    local backup_path="$1"
    
    log_info "Creating backup metadata..."
    
    cat > "$backup_path/backup-info.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$ENVIRONMENT",
  "backup_type": "$BACKUP_TYPE",
  "version": "$(docker-compose exec -T backend node -e "console.log(require('./package.json').version)" 2>/dev/null || echo 'unknown')",
  "services": {
    "backend": "$(docker-compose ps backend --format json | jq -r '.[0].State' 2>/dev/null || echo 'unknown')",
    "frontend": "$(docker-compose ps frontend --format json | jq -r '.[0].State' 2>/dev/null || echo 'unknown')",
    "postgres": "$(docker-compose ps postgres --format json | jq -r '.[0].State' 2>/dev/null || echo 'unknown')",
    "redis": "$(docker-compose ps redis --format json | jq -r '.[0].State' 2>/dev/null || echo 'unknown')"
  },
  "system": {
    "hostname": "$(hostname)",
    "disk_usage": "$(df -h /opt/n8n-streamdeck | tail -1 | awk '{print $5}')",
    "memory_usage": "$(free -h | grep Mem | awk '{print $3"/"$2}')"
  }
}
EOF
    
    # Create backup manifest
    find "$backup_path" -type f -exec basename {} \; | sort > "$backup_path/manifest.txt"
    
    log_success "Backup metadata created"
}

# Verify backup integrity
verify_backup() {
    local backup_path="$1"
    
    log_info "Verifying backup integrity..."
    
    local errors=0
    
    # Check if backup directory exists
    if [[ ! -d "$backup_path" ]]; then
        log_error "Backup directory does not exist: $backup_path"
        return 1
    fi
    
    # Verify database backup
    if [[ "$BACKUP_TYPE" == "full" || "$BACKUP_TYPE" == "database" ]]; then
        if [[ -f "$backup_path/database.sql.gz" ]]; then
            if ! gzip -t "$backup_path/database.sql.gz"; then
                log_error "Database backup is corrupted"
                errors=$((errors + 1))
            fi
        else
            log_warning "Database backup not found"
        fi
    fi
    
    # Verify data backups
    if [[ "$BACKUP_TYPE" == "full" || "$BACKUP_TYPE" == "data" ]]; then
        for file in backend-data.tar.gz redis-data.tar.gz config.tar.gz ssl.tar.gz; do
            if [[ -f "$backup_path/$file" ]]; then
                if ! tar -tzf "$backup_path/$file" >/dev/null 2>&1; then
                    log_error "$file backup is corrupted"
                    errors=$((errors + 1))
                fi
            fi
        done
    fi
    
    # Check backup metadata
    if [[ ! -f "$backup_path/backup-info.json" ]]; then
        log_warning "Backup metadata not found"
    fi
    
    if [[ $errors -eq 0 ]]; then
        log_success "Backup verification passed"
        return 0
    else
        log_error "Backup verification failed with $errors errors"
        return 1
    fi
}

# Calculate backup size
calculate_backup_size() {
    local backup_path="$1"
    
    du -sh "$backup_path" | cut -f1
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    local deleted_count=0
    
    # Find and delete old backups
    while IFS= read -r -d '' backup_dir; do
        local backup_name=$(basename "$backup_dir")
        local backup_date=$(echo "$backup_name" | grep -oE '[0-9]{8}-[0-9]{6}' || echo "")
        
        if [[ -n "$backup_date" ]]; then
            local backup_timestamp=$(date -d "${backup_date:0:8} ${backup_date:9:2}:${backup_date:11:2}:${backup_date:13:2}" +%s 2>/dev/null || echo "0")
            local cutoff_timestamp=$(date -d "$RETENTION_DAYS days ago" +%s)
            
            if [[ $backup_timestamp -lt $cutoff_timestamp ]]; then
                log_info "Deleting old backup: $backup_name"
                rm -rf "$backup_dir"
                deleted_count=$((deleted_count + 1))
            fi
        fi
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup-*" -print0 2>/dev/null || true)
    
    if [[ $deleted_count -gt 0 ]]; then
        log_success "Deleted $deleted_count old backups"
    else
        log_info "No old backups to delete"
    fi
}

# Send backup notification
send_notification() {
    local backup_path="$1"
    local backup_size="$2"
    local status="$3"
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        local emoji="✅"
        
        if [[ "$status" != "success" ]]; then
            color="danger"
            emoji="❌"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"$emoji Backup $status\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"Type\", \"value\": \"$BACKUP_TYPE\", \"short\": true},
                        {\"title\": \"Size\", \"value\": \"$backup_size\", \"short\": true},
                        {\"title\": \"Path\", \"value\": \"$(basename "$backup_path")\", \"short\": true}
                    ],
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
}

# Main backup function
main() {
    local start_time=$(date +%s)
    
    log_info "=== N8N StreamDeck Backup ==="
    log_info "Environment: $ENVIRONMENT"
    log_info "Backup Type: $BACKUP_TYPE"
    log_info "Retention: $RETENTION_DAYS days"
    log_info "============================"
    
    # Create backup directory
    local backup_path=$(create_backup_directory)
    local backup_name=$(basename "$backup_path")
    
    log_info "Backup location: $backup_path"
    
    # Perform backup based on type
    case "$BACKUP_TYPE" in
        full)
            backup_database "$backup_path"
            backup_data "$backup_path"
            backup_logs "$backup_path"
            ;;
        database)
            backup_database "$backup_path"
            ;;
        data)
            backup_data "$backup_path"
            ;;
        logs)
            backup_logs "$backup_path"
            ;;
        *)
            log_error "Invalid backup type: $BACKUP_TYPE. Use: full, database, data, logs"
            exit 1
            ;;
    esac
    
    # Create metadata
    create_backup_metadata "$backup_path"
    
    # Verify backup
    if verify_backup "$backup_path"; then
        local backup_size=$(calculate_backup_size "$backup_path")
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_success "Backup completed successfully in ${duration}s"
        log_info "Backup name: $backup_name"
        log_info "Backup size: $backup_size"
        
        # Send success notification
        send_notification "$backup_path" "$backup_size" "success"
        
        # Cleanup old backups
        cleanup_old_backups
        
        # Update backup log
        echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") - Backup completed: $backup_name ($backup_size)" >> "$BACKUP_DIR/backup.log"
        
    else
        log_error "Backup verification failed"
        send_notification "$backup_path" "unknown" "failed"
        exit 1
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [full|database|data|logs]"
    echo ""
    echo "Backup types:"
    echo "  full       - Complete backup (database + data + logs)"
    echo "  database   - Database only"
    echo "  data       - Application data only"
    echo "  logs       - Application logs only"
    echo ""
    echo "Environment variables:"
    echo "  BACKUP_ENV         - Environment name (default: production)"
    echo "  RETENTION_DAYS     - Backup retention in days (default: 30)"
    echo "  DB_PASSWORD        - Database password"
    echo "  SLACK_WEBHOOK_URL  - Slack webhook for notifications"
    echo ""
    echo "Examples:"
    echo "  $0 full            - Create full backup"
    echo "  $0 database        - Backup database only"
    echo "  RETENTION_DAYS=7 $0 full - Full backup with 7-day retention"
}

# Handle help flag
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# List backups
if [[ "${1:-}" == "list" ]]; then
    log_info "Available backups:"
    if [[ -d "$BACKUP_DIR" ]]; then
        ls -la "$BACKUP_DIR" | grep '^d' | awk '{print $9, $6, $7, $8}' | grep -v '^\.$\|^\.\.$'
    else
        log_info "No backups directory found"
    fi
    exit 0
fi

# Restore backup (basic restore functionality)
if [[ "${1:-}" == "restore" ]]; then
    BACKUP_NAME=${2:-}
    if [[ -z "$BACKUP_NAME" ]]; then
        log_error "Please specify backup name to restore"
        exit 1
    fi
    
    RESTORE_PATH="$BACKUP_DIR/$BACKUP_NAME"
    if [[ ! -d "$RESTORE_PATH" ]]; then
        log_error "Backup not found: $BACKUP_NAME"
        exit 1
    fi
    
    log_info "Restoring from backup: $BACKUP_NAME"
    log_warning "This will overwrite current data. Continue? (y/N)"
    read -r response
    if [[ "$response" != "y" && "$response" != "Y" ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    # Restore database
    if [[ -f "$RESTORE_PATH/database.sql.gz" ]]; then
        log_info "Restoring database..."
        gunzip -c "$RESTORE_PATH/database.sql.gz" | docker-compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"
        log_success "Database restored"
    fi
    
    # Restore data
    if [[ -f "$RESTORE_PATH/backend-data.tar.gz" ]]; then
        log_info "Restoring backend data..."
        docker run --rm -v n8n-streamdeck-backend-data:/data -v "$RESTORE_PATH:/backup" alpine tar xzf /backup/backend-data.tar.gz -C /data
        log_success "Backend data restored"
    fi
    
    if [[ -f "$RESTORE_PATH/redis-data.tar.gz" ]]; then
        log_info "Restoring Redis data..."
        docker run --rm -v n8n-streamdeck-redis-data:/data -v "$RESTORE_PATH:/backup" alpine tar xzf /backup/redis-data.tar.gz -C /data
        log_success "Redis data restored"
    fi
    
    log_success "Restore completed"
    exit 0
fi

# Run main function
main "$@"