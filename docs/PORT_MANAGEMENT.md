# Port Management

This document describes the port management system for the N8N StreamDeck development environment.

## Overview

The development environment uses fixed ports to prevent conflicts and ensure consistent behavior:

- **Frontend (Next.js)**: Port 3000
- **Backend (Express)**: Port 3001
- **Storybook**: Port 6006
- **Playwright UI**: Port 9323

## Problem Solved

Previously, Next.js would automatically find an available port if port 3000 was in use, sometimes claiming port 3001 and causing the backend to fail. This system prevents that by:

1. **Fixed Port Assignment**: Services are configured to use specific ports only
2. **Port Conflict Detection**: Automatic detection of port conflicts before starting services
3. **Automatic Cleanup**: Killing processes that are using required ports
4. **Graceful Shutdown**: Proper cleanup when stopping development services

## Usage

### Starting Development Services

```bash
# Start all services (recommended)
npm run dev

# Start individual services
npm run dev:frontend
npm run dev:backend

# Use the old parallel method (not recommended)
npm run dev:parallel
```

### Port Management Commands

```bash
# Check if development ports are available
npm run dev:check

# Clean up all development ports
npm run dev:clean

# Stop all running services
npm run dev:stop
```

### Manual Port Manager Usage

```bash
# Check port availability
node scripts/port-manager.js check

# Clean up ports
node scripts/port-manager.js clean

# Start all services
node scripts/port-manager.js start

# Start specific service
node scripts/port-manager.js start frontend
node scripts/port-manager.js start backend

# Stop all services
node scripts/port-manager.js stop
```

## How It Works

### Port Conflict Prevention

1. **Fixed Port Configuration**: Each service is configured with a specific port
2. **Environment Variables**: `PORT` environment variable is set explicitly
3. **Next.js Port Locking**: Uses `--port` flag to prevent automatic port changes
4. **Pre-flight Checks**: Ports are checked and cleaned before starting services

### Automatic Cleanup

The port manager automatically:

- Detects processes using required ports
- Kills conflicting processes before starting services
- Handles graceful shutdown with SIGTERM/SIGINT
- Force kills processes if graceful shutdown fails
- Cleans up Node.js development processes

### Signal Handling

The port manager handles these signals for graceful shutdown:

- `SIGINT` (Ctrl+C)
- `SIGTERM` (Termination request)
- `SIGQUIT` (Quit request)
- `uncaughtException`
- `unhandledRejection`

## Configuration

### Port Assignments

Ports are defined in `scripts/port-manager.js`:

```javascript
const PORTS = {
  FRONTEND: 3000,
  BACKEND: 3001,
  STORYBOOK: 6006,
  PLAYWRIGHT_UI: 9323,
};
```

### Service Configuration

Services are configured with:

```javascript
const SERVICES = {
  frontend: {
    port: PORTS.FRONTEND,
    cwd: path.join(__dirname, '../apps/frontend'),
    command: 'npm',
    args: ['run', 'dev'],
    env: { PORT: PORTS.FRONTEND.toString() },
  },
  // ...
};
```

## Troubleshooting

### Port Already in Use

If you see port conflict errors:

```bash
# Clean up all development ports
npm run dev:clean

# Then start services
npm run dev
```

### Services Won't Start

1. Check if ports are available:

   ```bash
   npm run dev:check
   ```

2. Clean up ports:

   ```bash
   npm run dev:clean
   ```

3. Try starting individual services:
   ```bash
   npm run dev:backend
   # Wait for backend to start, then in another terminal:
   npm run dev:frontend
   ```

### Manual Port Cleanup

If the automatic cleanup doesn't work:

```bash
# Find processes using specific ports
lsof -ti:3000
lsof -ti:3001

# Kill specific processes
kill -9 <PID>

# Or kill all Node.js processes (use with caution)
pkill -f "node"
```

### Checking Port Usage

```bash
# Check what's using a specific port
lsof -i:3000

# Check all listening ports
netstat -tlnp | grep LISTEN
```

## Best Practices

1. **Always use `npm run dev`** instead of starting services individually
2. **Run `npm run dev:clean`** if you encounter port conflicts
3. **Use `Ctrl+C` to stop services** for proper cleanup
4. **Don't manually kill processes** unless necessary
5. **Check port availability** before starting development

## Integration with CI/CD

The port management system is designed for local development only. In production and CI environments:

- Use standard Docker port mapping
- Use environment-specific port configurations
- Don't rely on the port manager for production deployments

## Future Enhancements

Potential improvements to the port management system:

- [ ] Docker integration for development
- [ ] Port range allocation for multiple developers
- [ ] Integration with process managers (PM2, etc.)
- [ ] Health checks for running services
- [ ] Automatic service restart on crashes
