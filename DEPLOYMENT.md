# N8N StreamDeck Deployment Guide

This guide covers the complete deployment process for the N8N StreamDeck application, including development, staging, and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended)
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Node.js**: 18.0+ (for local development)
- **pnpm**: 8.0+
- **Git**: 2.30+

### Server Requirements

#### Staging Environment

- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 50GB SSD
- **Network**: 100 Mbps

#### Production Environment

- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 100GB SSD
- **Network**: 1 Gbps
- **Load Balancer**: Recommended for high availability

### Required Secrets

Create these secrets in your deployment environment:

```bash
# Database
DB_PASSWORD=<secure-random-password>

# Application
JWT_SECRET=<64-character-random-string>
ENCRYPTION_KEY=<32-character-random-string>

# N8N Integration
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_KEY=<your-n8n-api-key>

# Monitoring
GRAFANA_PASSWORD=<grafana-admin-password>

# Notifications
SLACK_WEBHOOK_URL=<slack-webhook-url>

# SSL (for production)
SSL_CERT_PATH=/path/to/ssl/cert
SSL_KEY_PATH=/path/to/ssl/key
```

## Environment Setup

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create deployment user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy
sudo mkdir -p /home/deploy/.ssh
sudo chown deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh

# Create deployment directory
sudo mkdir -p /opt/n8n-streamdeck
sudo chown deploy:deploy /opt/n8n-streamdeck
```

### 2. SSH Key Setup

```bash
# Generate SSH key for deployment (on your local machine)
ssh-keygen -t ed25519 -f ~/.ssh/n8n-streamdeck-deploy -C "n8n-streamdeck-deploy"

# Copy public key to server
ssh-copy-id -i ~/.ssh/n8n-streamdeck-deploy.pub deploy@your-server.com

# Test connection
ssh -i ~/.ssh/n8n-streamdeck-deploy deploy@your-server.com
```

### 3. Domain and SSL Setup

```bash
# Install Certbot (for Let's Encrypt SSL)
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Setup automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Development Deployment

### Local Development

```bash
# Clone repository
git clone https://github.com/ianwijma/n8n-streamdeck.git
cd n8n-streamdeck

# Install dependencies
pnpm install

# Start development environment
pnpm run docker:dev

# Or start individual services
pnpm run dev
```

### Development Environment Variables

Create `.env.local` files in each app directory:

```bash
# apps/backend/.env.local
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://n8n_streamdeck:dev_password_123@localhost:5432/n8n_streamdeck_dev

# apps/frontend/.env.local
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Development Commands

```bash
# Build all packages
pnpm run build

# Run tests
pnpm run test

# Run linting
pnpm run lint

# Format code
pnpm run format

# Type checking
pnpm run typecheck

# Start development servers
pnpm run dev

# Start with Docker
pnpm run docker:dev

# View logs
pnpm run docker:logs

# Stop services
pnpm run docker:stop
```

## Production Deployment

### 1. Initial Setup

```bash
# On the server as deploy user
cd /opt/n8n-streamdeck

# Create environment file
cat > .env << EOF
DOMAIN=your-domain.com
IMAGE_TAG=latest
DB_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
ENCRYPTION_KEY=$(openssl rand -base64 32)
GRAFANA_PASSWORD=$(openssl rand -base64 16)
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_KEY=your-n8n-api-key
EOF

# Secure the environment file
chmod 600 .env
```

### 2. Manual Deployment

```bash
# From your local machine
export PRODUCTION_HOST=your-server.com
export PRODUCTION_USER=deploy
export PRODUCTION_SSH_KEY="$(cat ~/.ssh/n8n-streamdeck-deploy)"
export IMAGE_TAG=v1.0.0

# Deploy to production
./scripts/deploy.sh production
```

### 3. Automated Deployment via CI/CD

The application includes GitHub Actions workflows for automated deployment:

- **CI Pipeline**: Runs on every push and PR
- **Release Pipeline**: Deploys to production on release

#### Setting up GitHub Secrets

```bash
# Required secrets in GitHub repository settings
PRODUCTION_HOST=your-server.com
PRODUCTION_USER=deploy
PRODUCTION_SSH_KEY=<private-key-content>
STAGING_HOST=staging.your-domain.com
STAGING_USER=deploy
STAGING_SSH_KEY=<private-key-content>
DB_PASSWORD=<database-password>
JWT_SECRET=<jwt-secret>
ENCRYPTION_KEY=<encryption-key>
GRAFANA_PASSWORD=<grafana-password>
N8N_BASE_URL=<n8n-instance-url>
N8N_API_KEY=<n8n-api-key>
SLACK_WEBHOOK_URL=<slack-webhook-url>
```

## CI/CD Pipeline

### Pipeline Stages

1. **Code Quality & Testing**
   - Type checking
   - Linting
   - Unit tests
   - Integration tests

2. **Security Scanning**
   - Dependency audit
   - Code analysis
   - Container scanning

3. **Build & Package**
   - Build applications
   - Create Docker images
   - Generate artifacts

4. **End-to-End Testing**
   - Playwright tests
   - API integration tests

5. **Deploy to Staging**
   - Zero-downtime deployment
   - Smoke tests
   - Integration verification

6. **Deploy to Production**
   - Backup current state
   - Zero-downtime deployment
   - Health checks
   - Performance verification

### Triggering Deployments

```bash
# Create a release (triggers production deployment)
git tag v1.0.0
git push origin v1.0.0

# Or use the release script
./scripts/release.sh patch

# Manual deployment via workflow dispatch
# Go to GitHub Actions → Release Pipeline → Run workflow
```

### Build Commands

```bash
# Local build
./scripts/build.sh

# Production build
BUILD_ENV=production ./scripts/build.sh

# Fast build (skip tests)
SKIP_TESTS=true ./scripts/build.sh

# Build with specific version
BUILD_VERSION=1.0.0 ./scripts/build.sh
```

## Monitoring and Maintenance

### Health Checks

```bash
# Application health
curl https://your-domain.com/health
curl https://your-domain.com/api/health

# Detailed health information
curl https://your-domain.com/api/health/detailed

# System metrics
curl https://your-domain.com/api/health/system

# Alert status
curl https://your-domain.com/api/health/alerts
```

### Monitoring Dashboards

- **Grafana**: `https://your-domain.com/grafana`
- **Prometheus**: `https://your-domain.com/prometheus`

### Log Management

```bash
# View application logs
docker-compose logs -f backend frontend

# View specific service logs
docker-compose logs -f backend

# View nginx logs
docker-compose logs -f nginx

# Export logs
docker-compose logs --no-color > application.log
```

### Database Management

```bash
# Connect to database
docker-compose exec postgres psql -U n8n_streamdeck -d n8n_streamdeck_prod

# Create backup
./scripts/backup.sh database

# Full backup
./scripts/backup.sh full

# List backups
./scripts/backup.sh list

# Restore from backup
./scripts/backup.sh restore backup-20240101-120000
```

### Performance Monitoring

```bash
# Run load tests
cd load-testing
artillery run artillery-config.yml

# Monitor resource usage
docker stats

# Check disk usage
df -h

# Monitor memory usage
free -h

# Check network connections
netstat -tulpn
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check container status
docker-compose ps

# View container logs
docker-compose logs backend frontend

# Check resource usage
docker stats

# Restart services
docker-compose restart backend frontend
```

#### 2. Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready

# Test database connection
docker-compose exec postgres psql -U n8n_streamdeck -d n8n_streamdeck_prod -c "SELECT 1;"

# Check database logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

#### 3. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout

# Renew certificate
sudo certbot renew

# Test nginx configuration
docker-compose exec nginx nginx -t

# Reload nginx
docker-compose exec nginx nginx -s reload
```

#### 4. High Memory Usage

```bash
# Check memory usage by container
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL

# Restart services to clear memory
docker-compose restart backend frontend

# Check for memory leaks
docker-compose exec backend node --inspect=0.0.0.0:9229 dist/index.js
```

#### 5. Network Connectivity Issues

```bash
# Test external connectivity
docker-compose exec backend curl -I https://google.com

# Check internal service communication
docker-compose exec frontend curl -I http://backend:3001/health

# Verify DNS resolution
docker-compose exec backend nslookup your-domain.com

# Check firewall rules
sudo ufw status
```

### Debug Mode

```bash
# Enable debug logging
docker-compose exec backend npm run debug

# Enable verbose logging
LOG_LEVEL=debug docker-compose up -d

# Run in development mode
NODE_ENV=development docker-compose up -d
```

### Performance Debugging

```bash
# Profile application
docker-compose exec backend node --prof dist/index.js

# Memory profiling
docker-compose exec backend node --inspect-brk=0.0.0.0:9229 dist/index.js

# CPU profiling
docker-compose exec backend node --cpu-prof dist/index.js
```

## Rollback Procedures

### Automatic Rollback

The deployment script includes automatic rollback on failure:

```bash
# Deploy with automatic rollback on failure
./scripts/deploy.sh production
```

### Manual Rollback

```bash
# List available backups
./scripts/rollback.sh list production

# Rollback to latest backup
./scripts/rollback.sh production

# Rollback to specific backup
./scripts/rollback.sh production backup-20240101-120000

# Interactive rollback selection
./scripts/rollback.sh production
```

### Emergency Rollback

```bash
# Quick rollback to previous version
docker-compose down
docker-compose pull
docker-compose up -d

# Or use specific image tags
IMAGE_TAG=v1.0.0 docker-compose up -d
```

### Database Rollback

```bash
# Stop application
docker-compose stop backend frontend

# Restore database from backup
./scripts/backup.sh restore backup-20240101-120000

# Start application
docker-compose start backend frontend
```

### Verification After Rollback

```bash
# Check application health
curl https://your-domain.com/health

# Verify version
curl https://your-domain.com/api/health | jq '.version'

# Check logs for errors
docker-compose logs -f --tail=100

# Run smoke tests
./scripts/smoke-test.sh production
```

## Security Considerations

### SSL/TLS Configuration

- Use strong cipher suites
- Enable HSTS headers
- Implement certificate pinning
- Regular certificate renewal

### Network Security

- Configure firewall rules
- Use VPN for administrative access
- Implement rate limiting
- Monitor for suspicious activity

### Application Security

- Regular security updates
- Dependency vulnerability scanning
- Input validation and sanitization
- Secure session management

### Data Protection

- Encrypt sensitive data at rest
- Secure backup storage
- Implement access controls
- Regular security audits

## Maintenance Schedule

### Daily

- Monitor application health
- Check error logs
- Verify backup completion

### Weekly

- Review performance metrics
- Update dependencies
- Security scan results
- Capacity planning review

### Monthly

- Full system backup
- Security audit
- Performance optimization
- Documentation updates

### Quarterly

- Disaster recovery testing
- Security penetration testing
- Infrastructure review
- Compliance assessment

## Support and Escalation

### Contact Information

- **Development Team**: dev@your-company.com
- **Operations Team**: ops@your-company.com
- **Security Team**: security@your-company.com

### Escalation Procedures

1. **Level 1**: Application issues, minor outages
2. **Level 2**: Service degradation, security concerns
3. **Level 3**: Complete outage, data loss, security breach

### Emergency Contacts

- **On-call Engineer**: +1-xxx-xxx-xxxx
- **Team Lead**: +1-xxx-xxx-xxxx
- **CTO**: +1-xxx-xxx-xxxx

---

For additional support, please refer to the [troubleshooting guide](./TROUBLESHOOTING.md) or contact the development team.
