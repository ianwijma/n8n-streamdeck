#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Port Manager for N8N StreamDeck Development
 *
 * This script manages ports for development services to prevent conflicts
 * and provides cleanup mechanisms.
 */

const PORTS = {
  FRONTEND: 3000,
  BACKEND: 3001,
  STORYBOOK: 6006,
  PLAYWRIGHT_UI: 9323,
};

const SERVICES = {
  frontend: {
    port: PORTS.FRONTEND,
    cwd: path.join(__dirname, '../apps/frontend'),
    command: 'npm',
    args: ['run', 'dev'],
    env: { PORT: PORTS.FRONTEND.toString() },
  },
  backend: {
    port: PORTS.BACKEND,
    cwd: path.join(__dirname, '../apps/backend'),
    command: 'npm',
    args: ['run', 'dev'],
    env: { PORT: PORTS.BACKEND.toString() },
  },
};

class PortManager {
  constructor() {
    this.runningProcesses = new Map();
    this.setupSignalHandlers();
  }

  /**
   * Check if a port is in use using multiple methods
   */
  async isPortInUse(port) {
    // Method 1: lsof
    try {
      const lsofResult = execSync(`lsof -ti:${port}`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      if (lsofResult.trim().length > 0) {
        return true;
      }
    } catch (error) {
      // lsof returns non-zero exit code when no processes found
    }

    // Method 2: netstat (more reliable for some cases)
    try {
      const netstatResult = execSync(`netstat -tlnp | grep :${port}`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      if (netstatResult.trim().length > 0) {
        return true;
      }
    } catch (error) {
      // netstat returns non-zero exit code when no matches found
    }

    // Method 3: ss command (modern alternative)
    try {
      const ssResult = execSync(`ss -tlnp | grep :${port}`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      if (ssResult.trim().length > 0) {
        return true;
      }
    } catch (error) {
      // ss returns non-zero exit code when no matches found
    }

    return false;
  }

  /**
   * Get all PIDs using a specific port
   */
  getPortPids(port) {
    const allPids = new Set();

    // Method 1: lsof
    try {
      const lsofResult = execSync(`lsof -ti:${port}`, {
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();
      if (lsofResult) {
        lsofResult.split('\n').forEach((pid) => {
          if (pid.trim()) allPids.add(pid.trim());
        });
      }
    } catch (error) {
      // lsof failed, continue with other methods
    }

    // Method 2: netstat + extract PID
    try {
      const netstatResult = execSync(`netstat -tlnp | grep :${port}`, {
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();
      if (netstatResult) {
        const lines = netstatResult.split('\n');
        for (const line of lines) {
          const match = line.match(/(\d+)\/\w+\s*$/);
          if (match && match[1]) {
            allPids.add(match[1]);
          }
        }
      }
    } catch (error) {
      // netstat failed, continue
    }

    // Method 3: fuser (if available)
    try {
      const fuserResult = execSync(`fuser ${port}/tcp 2>/dev/null`, {
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();
      if (fuserResult) {
        fuserResult.split(/\s+/).forEach((pid) => {
          if (pid.trim() && /^\d+$/.test(pid.trim())) {
            allPids.add(pid.trim());
          }
        });
      }
    } catch (error) {
      // fuser failed or not available, continue
    }

    return Array.from(allPids);
  }

  /**
   * Kill processes using a specific port
   */
  async killPort(port) {
    try {
      console.log(`🔍 Checking for processes on port ${port}...`);
      const pidList = this.getPortPids(port);

      if (pidList.length > 0) {
        console.log(
          `💀 Killing ${pidList.length} process(es) on port ${port}: ${pidList.join(', ')}`
        );

        for (const pid of pidList) {
          try {
            // Try graceful kill first
            execSync(`kill -TERM ${pid}`, { stdio: 'pipe' });
            console.log(`📋 Sent SIGTERM to process ${pid}`);
          } catch (error) {
            console.log(`⚠️  Could not send SIGTERM to process ${pid}`);
          }
        }

        // Wait a moment for graceful shutdown
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Force kill any remaining processes
        const remainingPids = this.getPortPids(port);
        for (const pid of remainingPids) {
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
            console.log(`💀 Force killed process ${pid}`);
          } catch (error) {
            console.log(`⚠️  Process ${pid} may have already exited`);
          }
        }

        // Wait a moment for processes to fully terminate
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify port is actually free
        let retries = 5;
        while (retries > 0 && (await this.isPortInUse(port))) {
          console.log(
            `⏳ Waiting for port ${port} to be freed... (${retries} retries left)`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          retries--;
        }

        if (await this.isPortInUse(port)) {
          console.log(
            `⚠️  Port ${port} is still in use after cleanup attempts`
          );
        }
      } else {
        console.log(`✅ Port ${port} is already free`);
      }
    } catch (error) {
      console.log(`✅ Port ${port} is free`);
    }
  }

  /**
   * Kill all development ports
   */
  async killAllPorts() {
    console.log('🧹 Cleaning up all development ports...');

    for (const port of Object.values(PORTS)) {
      await this.killPort(port);
    }

    // Also kill any Node.js processes that might be related
    try {
      console.log('🔍 Cleaning up Node.js development processes...');
      const nodeProcesses = execSync(
        `ps aux | grep -E "(next dev|tsx watch)" | grep -v grep`,
        {
          encoding: 'utf8',
          stdio: 'pipe',
        }
      ).trim();

      if (nodeProcesses) {
        const lines = nodeProcesses.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[1];
          if (pid && /^\d+$/.test(pid)) {
            try {
              execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
              console.log(`✅ Killed Node.js process ${pid}`);
            } catch (error) {
              // Process may have already exited
            }
          }
        }
      }
    } catch (error) {
      // No matching processes found
      console.log('✅ No Node.js development processes to clean up');
    }

    console.log('✨ Port cleanup completed');
  }

  /**
   * Check if required ports are available
   */
  async checkPorts() {
    console.log('🔍 Checking port availability...');

    const conflicts = [];

    for (const [name, port] of Object.entries(PORTS)) {
      const inUse = await this.isPortInUse(port);
      if (inUse) {
        conflicts.push({ name, port });
        console.log(`❌ Port ${port} (${name}) is in use`);
      } else {
        console.log(`✅ Port ${port} (${name}) is available`);
      }
    }

    return conflicts;
  }

  /**
   * Start a service with proper port management
   */
  async startService(serviceName) {
    const service = SERVICES[serviceName];
    if (!service) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    console.log(
      `🚀 Starting ${serviceName} service on port ${service.port}...`
    );

    // Check if port is available
    const inUse = await this.isPortInUse(service.port);
    if (inUse) {
      console.log(`⚠️  Port ${service.port} is in use. Cleaning up...`);
      await this.killPort(service.port);
    }

    // Start the service
    const env = {
      ...process.env,
      ...service.env,
      // Prevent Next.js from changing ports
      PORT: service.port.toString(),
      // Force Next.js to use the specified port
      NEXT_DEV_PORT: service.port.toString(),
    };

    const child = spawn(service.command, service.args, {
      cwd: service.cwd,
      env,
      stdio: 'inherit',
    });

    this.runningProcesses.set(serviceName, {
      process: child,
      port: service.port,
    });

    child.on('exit', (code) => {
      console.log(`📋 ${serviceName} service exited with code ${code}`);
      this.runningProcesses.delete(serviceName);
    });

    child.on('error', (error) => {
      console.error(`❌ Error starting ${serviceName}:`, error);
      this.runningProcesses.delete(serviceName);
    });

    return child;
  }

  /**
   * Start all development services
   */
  async startAll() {
    console.log('🚀 Starting all development services...');

    // Clean up any existing processes first
    await this.killAllPorts();

    // Wait a moment for cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Start services in order (backend first, then frontend)
    try {
      await this.startService('backend');
      // Wait longer for backend to fully start
      await new Promise((resolve) => setTimeout(resolve, 5000));

      await this.startService('frontend');

      console.log('✨ All services started successfully!');
      console.log(`📱 Frontend: http://localhost:${PORTS.FRONTEND}`);
      console.log(`🔧 Backend: http://localhost:${PORTS.BACKEND}`);
    } catch (error) {
      console.error('❌ Error starting services:', error);
      await this.stopAll();
      process.exit(1);
    }
  }

  /**
   * Stop all running services
   */
  async stopAll() {
    console.log('🛑 Stopping all services...');

    for (const [serviceName, { process, port }] of this.runningProcesses) {
      console.log(`🛑 Stopping ${serviceName} (port ${port})...`);
      process.kill('SIGTERM');
    }

    // Wait for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Force kill if necessary
    for (const [serviceName, { process, port }] of this.runningProcesses) {
      if (!process.killed) {
        console.log(`💀 Force killing ${serviceName}...`);
        process.kill('SIGKILL');
      }
    }

    this.runningProcesses.clear();

    // Clean up ports
    await this.killAllPorts();
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n📋 Received ${signal}, shutting down gracefully...`);
        await this.stopAll();
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('❌ Uncaught exception:', error);
      await this.stopAll();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
      await this.stopAll();
      process.exit(1);
    });
  }
}

// CLI Interface
async function main() {
  const portManager = new PortManager();
  const command = process.argv[2];

  switch (command) {
    case 'check':
      const conflicts = await portManager.checkPorts();
      if (conflicts.length > 0) {
        console.log(
          '\n❌ Port conflicts detected. Run "npm run dev:clean" to resolve.'
        );
        process.exit(1);
      } else {
        console.log('\n✅ All ports are available');
      }
      break;

    case 'clean':
      await portManager.killAllPorts();
      break;

    case 'start':
      const service = process.argv[3];
      if (service && SERVICES[service]) {
        await portManager.startService(service);
        // Keep the process alive
        process.stdin.resume();
      } else if (!service) {
        await portManager.startAll();
        // Keep the process alive
        process.stdin.resume();
      } else {
        console.error(`❌ Unknown service: ${service}`);
        console.log('Available services:', Object.keys(SERVICES).join(', '));
        process.exit(1);
      }
      break;

    case 'stop':
      await portManager.stopAll();
      break;

    default:
      console.log(`
🔧 N8N StreamDeck Port Manager

Usage:
  node scripts/port-manager.js <command>

Commands:
  check    Check if development ports are available
  clean    Kill all processes using development ports
  start    Start all development services (or specify: frontend, backend)
  stop     Stop all running services

Examples:
  node scripts/port-manager.js check
  node scripts/port-manager.js clean
  node scripts/port-manager.js start
  node scripts/port-manager.js start frontend
  node scripts/port-manager.js stop
      `);
      break;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

module.exports = { PortManager, PORTS, SERVICES };
