# N8N Hybrid Development Setup

This guide explains how to run N8N in Docker while keeping the StreamDeck Backend running natively on your host machine for proper USB device access.

## Why Hybrid Setup?

- **N8N in Docker**: Isolated environment, consistent setup, easy database management
- **StreamDeck Backend Native**: Direct USB access to StreamDeck hardware
- **Best of Both Worlds**: Reliable N8N development with full StreamDeck functionality

## Quick Start

### 1. Start N8N Environment (Docker)

```bash
# Start N8N + PostgreSQL + Redis in Docker
pnpm dev:n8n-only

# Or manually
./scripts/start-n8n-only.sh
```

### 2. Start StreamDeck Backend (Native)

```bash
# In a separate terminal - runs natively with USB access
pnpm --filter @n8n-streamdeck/backend dev
```

### 3. Optional: Start StreamDeck Frontend

```bash
# In another terminal (optional)
pnpm --filter @n8n-streamdeck/frontend dev
```

## Service Overview

| Service                 | Location | URL                   | Purpose                                   |
| ----------------------- | -------- | --------------------- | ----------------------------------------- |
| **N8N**                 | Docker   | http://localhost:5678 | Workflow automation with StreamDeck nodes |
| **PostgreSQL**          | Docker   | localhost:5432        | N8N database                              |
| **Redis**               | Docker   | localhost:6379        | N8N caching/queues                        |
| **StreamDeck Backend**  | Native   | http://localhost:3001 | StreamDeck hardware interface             |
| **StreamDeck Frontend** | Native   | http://localhost:3000 | StreamDeck management UI                  |

## Network Configuration

The setup uses `host.docker.internal` to allow N8N (in Docker) to communicate with the StreamDeck Backend (on host):

- **From N8N to StreamDeck Backend**: `http://host.docker.internal:3001`
- **From Host to N8N**: `http://localhost:5678`

## Development Workflow

### Initial Setup

1. **Configure Environment**:

   ```bash
   cp .env.n8n.example .env
   # Edit .env with your settings
   ```

2. **Build N8N Node**:

   ```bash
   pnpm build:n8n-node
   ```

3. **Start Services**:

   ```bash
   # Terminal 1: N8N Environment
   pnpm dev:n8n-only

   # Terminal 2: StreamDeck Backend
   pnpm --filter @n8n-streamdeck/backend dev
   ```

### Making Changes to N8N Node

1. **Edit** `apps/n8n-node/src/`
2. **Rebuild**: `pnpm build:n8n-node`
3. **Restart N8N**: `docker-compose -f docker-compose.n8n.yml restart n8n`

### Testing the Integration

1. **Connect StreamDeck**: Plug in your StreamDeck device
2. **Configure Buttons**: Use StreamDeck Frontend (http://localhost:3000)
3. **Setup N8N Credentials**:
   - Go to N8N (http://localhost:5678)
   - Add StreamDeck API credentials:
     - **API URL**: `http://host.docker.internal:3001`
     - **API Key**: `dev-api-key` (or your configured key)
4. **Create Workflow**:
   - Add StreamDeck Trigger node
   - Configure device and button selection
   - Add action nodes
   - Activate workflow
5. **Test**: Press StreamDeck button to trigger workflow

## Commands Reference

### N8N Environment Management

```bash
# Start N8N environment
pnpm dev:n8n-only

# Stop N8N environment
pnpm stop:n8n

# View N8N logs
docker-compose -f docker-compose.n8n.yml logs -f n8n

# Restart N8N only
docker-compose -f docker-compose.n8n.yml restart n8n

# Clean restart (rebuild)
docker-compose -f docker-compose.n8n.yml up --build -d n8n
```

### StreamDeck Backend Management

```bash
# Start StreamDeck backend (native)
pnpm --filter @n8n-streamdeck/backend dev

# Build StreamDeck backend
pnpm --filter @n8n-streamdeck/backend build

# Test StreamDeck backend
curl http://localhost:3001/health
```

### Development Tools

```bash
# Build N8N node
pnpm build:n8n-node

# Test setup
pnpm test:n8n-setup

# Lint all
pnpm lint

# Type check all
pnpm typecheck
```

## Troubleshooting

### N8N Can't Connect to StreamDeck Backend

**Symptoms**: N8N shows connection errors when testing StreamDeck credentials

**Solutions**:

1. Verify StreamDeck backend is running: `curl http://localhost:3001/health`
2. Check N8N credentials use: `http://host.docker.internal:3001`
3. Ensure API key matches between services
4. Check Docker network: `docker network ls | grep n8n`

### StreamDeck Not Detected

**Symptoms**: StreamDeck backend can't find connected device

**Solutions**:

1. Ensure StreamDeck is plugged in via USB
2. Check device permissions (Linux): Add user to `plugdev` group
3. Restart StreamDeck backend after connecting device
4. Check backend logs for USB detection errors

### N8N Database Issues

**Symptoms**: N8N fails to start or shows database errors

**Solutions**:

1. Check PostgreSQL is running: `docker ps | grep postgres`
2. Reset database: `docker-compose -f docker-compose.n8n.yml down -v && pnpm dev:n8n-only`
3. Check database logs: `docker-compose -f docker-compose.n8n.yml logs postgres`

### Port Conflicts

**Symptoms**: Services fail to start due to port already in use

**Solutions**:

1. Check what's using ports: `lsof -i :5678` (or :3001, :5432, :6379)
2. Stop conflicting services
3. Or modify ports in `docker-compose.n8n.yml`

## Environment Variables

Key environment variables for the hybrid setup:

```bash
# .env file
STREAMDECK_API_KEY=dev-api-key
STREAMDECK_API_URL=http://localhost:3001
N8N_BASE_URL=http://localhost:5678
```

## Data Persistence

- **N8N Data**: Stored in Docker volume `n8n-streamdeck-data`
- **PostgreSQL Data**: Stored in Docker volume `n8n-streamdeck-postgres-data`
- **Redis Data**: Stored in Docker volume `n8n-streamdeck-redis-data`

To backup/restore:

```bash
# Backup
docker run --rm -v n8n-streamdeck-data:/data -v $(pwd):/backup alpine tar czf /backup/n8n-backup.tar.gz -C /data .

# Restore
docker run --rm -v n8n-streamdeck-data:/data -v $(pwd):/backup alpine tar xzf /backup/n8n-backup.tar.gz -C /data
```

## Performance Tips

1. **Allocate sufficient resources** to Docker (4GB+ RAM recommended)
2. **Use SSD storage** for Docker volumes
3. **Monitor resource usage**: `docker stats`
4. **Limit N8N log level** in production: Set `N8N_LOG_LEVEL=warn`

## Security Considerations

1. **Change default passwords** in production
2. **Use strong API keys** for StreamDeck backend
3. **Enable N8N authentication** for production use
4. **Restrict network access** to development ports
5. **Keep Docker images updated**
