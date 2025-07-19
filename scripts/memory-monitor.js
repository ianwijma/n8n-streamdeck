const fs = require('fs');
const axios = require('axios');

class MemoryMonitor {
  constructor() {
    this.data = [];
    this.interval = null;
    this.isRunning = false;
  }

  async start(baseUrl, outputFile, intervalMs = 5000) {
    console.log(`Starting memory monitoring for ${baseUrl}`);
    console.log(`Collecting data every ${intervalMs}ms`);
    console.log(`Output file: ${outputFile}`);

    this.isRunning = true;
    this.outputFile = outputFile;

    this.interval = setInterval(async () => {
      try {
        await this.collectMetrics(baseUrl);
      } catch (error) {
        console.error('Error collecting metrics:', error.message);
      }
    }, intervalMs);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.stop();
    });

    process.on('SIGTERM', () => {
      this.stop();
    });
  }

  async collectMetrics(baseUrl) {
    const timestamp = new Date().toISOString();

    try {
      // Get detailed health metrics
      const response = await axios.get(`${baseUrl}/api/health/detailed`, {
        timeout: 5000,
      });

      const healthData = response.data.data;

      const metrics = {
        timestamp,
        memory: {
          heapUsed: healthData.system?.memory?.used || 0,
          heapTotal: healthData.system?.memory?.total || 0,
          rss: healthData.system?.memory?.rss || 0,
          external: healthData.system?.memory?.external || 0,
          usage: healthData.system?.memory?.usage || 0,
        },
        cache: {
          size: healthData.cache?.size || 0,
          hitRate: healthData.cache?.hitRate || 0,
          memoryUsage: healthData.cache?.memoryUsage || 0,
        },
        devices: {
          connected: healthData.devices?.connected || 0,
          total: healthData.devices?.total || 0,
        },
        system: {
          uptime: healthData.uptime || 0,
          loadAverage: healthData.system?.loadAverage || [0, 0, 0],
        },
        performance: {
          status: healthData.status || 'unknown',
          checks: healthData.performanceChecks || {},
        },
      };

      this.data.push(metrics);

      // Log current memory usage
      const memUsage = metrics.memory.usage;
      const status = memUsage > 90 ? '🔴' : memUsage > 75 ? '🟡' : '🟢';
      console.log(
        `${status} Memory: ${memUsage}% | Cache: ${metrics.cache.hitRate}% | Devices: ${metrics.devices.connected}/${metrics.devices.total}`
      );

      // Save data periodically
      if (this.data.length % 10 === 0) {
        this.saveData();
      }
    } catch (error) {
      console.error(`Failed to collect metrics: ${error.message}`);

      // Still record the timestamp and error
      this.data.push({
        timestamp,
        error: error.message,
        memory: { heapUsed: 0, heapTotal: 0, rss: 0, external: 0, usage: 0 },
        cache: { size: 0, hitRate: 0, memoryUsage: 0 },
        devices: { connected: 0, total: 0 },
        system: { uptime: 0, loadAverage: [0, 0, 0] },
        performance: { status: 'error', checks: {} },
      });
    }
  }

  saveData() {
    if (this.outputFile && this.data.length > 0) {
      try {
        const jsonData = JSON.stringify(
          {
            metadata: {
              startTime: this.data[0]?.timestamp,
              endTime: this.data[this.data.length - 1]?.timestamp,
              totalSamples: this.data.length,
              intervalMs: 5000,
            },
            metrics: this.data,
            summary: this.generateSummary(),
          },
          null,
          2
        );

        fs.writeFileSync(this.outputFile, jsonData);
        console.log(
          `💾 Saved ${this.data.length} data points to ${this.outputFile}`
        );
      } catch (error) {
        console.error('Error saving data:', error.message);
      }
    }
  }

  generateSummary() {
    if (this.data.length === 0) return {};

    const memoryUsages = this.data
      .map((d) => d.memory.usage)
      .filter((u) => u > 0);
    const cacheHitRates = this.data
      .map((d) => d.cache.hitRate)
      .filter((r) => r >= 0);
    const connectedDevices = this.data.map((d) => d.devices.connected);

    return {
      memory: {
        min: Math.min(...memoryUsages),
        max: Math.max(...memoryUsages),
        avg: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        samples: memoryUsages.length,
      },
      cache: {
        minHitRate: Math.min(...cacheHitRates),
        maxHitRate: Math.max(...cacheHitRates),
        avgHitRate:
          cacheHitRates.reduce((a, b) => a + b, 0) / cacheHitRates.length,
        samples: cacheHitRates.length,
      },
      devices: {
        minConnected: Math.min(...connectedDevices),
        maxConnected: Math.max(...connectedDevices),
        avgConnected:
          connectedDevices.reduce((a, b) => a + b, 0) / connectedDevices.length,
      },
      errors: this.data.filter((d) => d.error).length,
      healthStatus: {
        healthy: this.data.filter((d) => d.performance.status === 'healthy')
          .length,
        warning: this.data.filter((d) => d.performance.status === 'warning')
          .length,
        critical: this.data.filter((d) => d.performance.status === 'critical')
          .length,
      },
    };
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
    this.saveData();

    console.log('\n📊 Memory monitoring stopped');
    console.log(`Total samples collected: ${this.data.length}`);

    const summary = this.generateSummary();
    if (summary.memory) {
      console.log(
        `Memory usage: ${summary.memory.min.toFixed(1)}% - ${summary.memory.max.toFixed(1)}% (avg: ${summary.memory.avg.toFixed(1)}%)`
      );
    }
    if (summary.cache) {
      console.log(
        `Cache hit rate: ${summary.cache.minHitRate.toFixed(1)}% - ${summary.cache.maxHitRate.toFixed(1)}% (avg: ${summary.cache.avgHitRate.toFixed(1)}%)`
      );
    }

    process.exit(0);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(
      'Usage: node memory-monitor.js <baseUrl> <outputFile> [intervalMs]'
    );
    console.log(
      'Example: node memory-monitor.js http://localhost:3001 ./memory-usage.json 5000'
    );
    process.exit(1);
  }

  const [baseUrl, outputFile, intervalMs] = args;
  const monitor = new MemoryMonitor();

  monitor.start(baseUrl, outputFile, parseInt(intervalMs) || 5000);
}

module.exports = { MemoryMonitor };
