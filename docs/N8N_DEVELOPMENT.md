# N8N Development Environment

This guide explains how to set up a development N8N instance with the StreamDeck custom node pre-installed.

## Quick Start

1. **Start the N8N development environment:**

   ```bash
   ./scripts/start-n8n-dev.sh
   ```

2. **Access N8N:**
   - Open http://localhost:5678 in your browser
   - The StreamDeck nodes should be available in the node palette

3. **Access StreamDeck Backend:**
   - API: http://localhost:3001
   - Health check: http://localhost:3001/health

## Manual Setup

If you prefer to set up manually:

### 1. Build the N8N Node

```bash
# Build shared packages
pnpm --filter @n8n-streamdeck/shared build
pnpm --filter @n8n-streamdeck/config build

# Build the N8N node
pnpm --filter @n8n-streamdeck/n8n-node build
```

### 2. Start Services

```bash
# Start N8N with StreamDeck backend
docker-compose -f docker-compose.dev.yml up --build -d n8n backend postgres redis

# Or start individual services
docker-compose -f docker-compose.dev.yml up -d postgres redis
docker-compose -f docker-compose.dev.yml up -d backend
docker-compose -f docker-compose.dev.yml up -d n8n
```

### 3. Start Frontend (Optional)

```bash
pnpm --filter @n8n-streamdeck/frontend dev
```

## Available Services

| Service             | URL                   | Description              |
| ------------------- | --------------------- | ------------------------ |
| N8N                 | http://localhost:5678 | N8N workflow automation  |
| StreamDeck Backend  | http://localhost:3001 | StreamDeck API server    |
| StreamDeck Frontend | http://localhost:3000 | StreamDeck management UI |
| PostgreSQL          | localhost:5432        | Database                 |
| Redis               | localhost:6379        | Cache & sessions         |

## Environment Configuration

Copy the example environment file:

```bash
cp .env.n8n.example .env
```

Key environment variables:

- `STREAMDECK_API_KEY`: API key for StreamDeck backend authentication
- `STREAMDECK_API_URL`: URL of the StreamDeck backend API
- `N8N_BASE_URL`: Base URL for N8N instance
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

## StreamDeck Nodes

The following custom nodes are available in N8N:

### StreamDeck Trigger Node

- **Purpose**: Triggers workflows when StreamDeck buttons are pressed
- **Location**: Triggers > StreamDeck Trigger
- **Configuration**:
  - StreamDeck API credentials
  - Device selection
  - Button selection
  - Trigger conditions

### StreamDeck Credentials

- **Purpose**: Store StreamDeck API connection details
- **Configuration**:
  - API URL: `http://backend:3001` (internal Docker network)
  - API Key: Your StreamDeck API key

## Development Workflow

### 1. Making Changes to the N8N Node

```bash
# Make your changes in apps/n8n-node/src/

# Rebuild the node
pnpm --filter @n8n-streamdeck/n8n-node build

# Restart N8N container to pick up changes
docker-compose -f docker-compose.dev.yml restart n8n
```

### 2. Testing the Integration

1. **Set up StreamDeck device:**
   - Connect your StreamDeck device
   - Configure buttons in the StreamDeck frontend (http://localhost:3000)

2. **Create N8N workflow:**
   - Add StreamDeck Trigger node
   - Configure credentials and device/button selection
   - Add action nodes (email, webhook, etc.)
   - Activate the workflow

3. **Test the trigger:**
   - Press the configured StreamDeck button
   - Verify the workflow executes

### 3. Debugging

**View N8N logs:**

```bash
docker-compose -f docker-compose.dev.yml logs -f n8n
```

**View StreamDeck backend logs:**

```bash
docker-compose -f docker-compose.dev.yml logs -f backend
```

**Access N8N container:**

```bash
docker exec -it n8n-streamdeck-n8n-dev sh
```

## Troubleshooting

### N8N doesn't show StreamDeck nodes

1. Check if the custom node was built correctly:

   ```bash
   ls -la apps/n8n-node/dist/
   ```

2. Check N8N logs for errors:

   ```bash
   docker-compose -f docker-compose.dev.yml logs n8n
   ```

3. Verify the node is in the correct location inside the container:
   ```bash
   docker exec -it n8n-streamdeck-n8n-dev ls -la /home/node/.n8n/nodes/
   ```

### StreamDeck API connection fails

1. Verify backend is running:

   ```bash
   curl http://localhost:3001/health
   ```

2. Check network connectivity between containers:

   ```bash
   docker exec -it n8n-streamdeck-n8n-dev wget -qO- http://backend:3001/health
   ```

3. Verify API credentials in N8N credentials configuration

### Database connection issues

1. Check PostgreSQL is running:

   ```bash
   docker-compose -f docker-compose.dev.yml ps postgres
   ```

2. Test database connection:
   ```bash
   docker exec -it n8n-streamdeck-postgres-dev psql -U n8n_streamdeck -d n8n_streamdeck_dev -c "SELECT 1;"
   ```

## Cleanup

Stop and remove all containers:

```bash
docker-compose -f docker-compose.dev.yml down

# Remove volumes (WARNING: This will delete all data)
docker-compose -f docker-compose.dev.yml down -v
```

## Production Deployment

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md).
