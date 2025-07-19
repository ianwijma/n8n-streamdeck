import { Logger, LogLevel } from '@n8n-streamdeck/shared';
import { EventEmitter } from 'events';

const logger = new Logger({ level: LogLevel.DEBUG }, 'MetricsCollector');

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface AlertThreshold {
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  value: number;
  duration?: number; // Duration in ms to maintain condition before alerting
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  disk?: {
    used: number;
    total: number;
    percentage: number;
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
  };
}

export interface ApplicationMetrics {
  requests: {
    total: number;
    rate: number; // requests per second
    errors: number;
    errorRate: number;
  };
  responses: {
    averageTime: number;
    p95Time: number;
    p99Time: number;
  };
  devices: {
    connected: number;
    total: number;
    errors: number;
  };
  buttons: {
    presses: number;
    errors: number;
  };
  n8n: {
    requests: number;
    errors: number;
    averageResponseTime: number;
  };
}

class MetricsCollector extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map();
  private alertThresholds: AlertThreshold[] = [];
  private alertStates: Map<string, { triggered: boolean; since: number }> =
    new Map();
  private collectionInterval: NodeJS.Timeout | null = null;
  private maxMetricsPerType = 1000; // Limit memory usage
  private collectionIntervalMs = 30000; // 30 seconds

  constructor() {
    super();
    this.setupDefaultThresholds();
    this.startCollection();
  }

  private setupDefaultThresholds() {
    this.alertThresholds = [
      {
        metric: 'system.memory.percentage',
        condition: 'gt',
        value: 85,
        duration: 60000, // 1 minute
        severity: 'high',
      },
      {
        metric: 'system.cpu.usage',
        condition: 'gt',
        value: 90,
        duration: 30000, // 30 seconds
        severity: 'high',
      },
      {
        metric: 'application.requests.errorRate',
        condition: 'gt',
        value: 10, // 10% error rate
        duration: 60000,
        severity: 'medium',
      },
      {
        metric: 'application.responses.p99Time',
        condition: 'gt',
        value: 5000, // 5 seconds
        duration: 120000, // 2 minutes
        severity: 'medium',
      },
      {
        metric: 'application.devices.errors',
        condition: 'gt',
        value: 5,
        duration: 300000, // 5 minutes
        severity: 'low',
      },
    ];
  }

  private startCollection() {
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.collectApplicationMetrics();
      this.checkAlerts();
    }, this.collectionIntervalMs);

    logger.info('Metrics collection started', {
      interval: `${this.collectionIntervalMs}ms`,
      maxMetricsPerType: this.maxMetricsPerType,
    });
  }

  public stopCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      logger.info('Metrics collection stopped');
    }
  }

  public recordMetric(metric: Omit<Metric, 'timestamp'>) {
    const fullMetric: Metric = {
      ...metric,
      timestamp: Date.now(),
    };

    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricArray = this.metrics.get(metric.name)!;
    metricArray.push(fullMetric);

    // Limit array size to prevent memory issues
    if (metricArray.length > this.maxMetricsPerType) {
      metricArray.splice(0, metricArray.length - this.maxMetricsPerType);
    }

    this.emit('metric', fullMetric);
  }

  private collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory metrics
    const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.recordMetric({
      name: 'system.memory.percentage',
      value: memoryPercentage,
      type: 'gauge',
      labels: { unit: 'percent' },
    });

    this.recordMetric({
      name: 'system.memory.heapUsed',
      value: Math.round(memUsage.heapUsed / 1024 / 1024),
      type: 'gauge',
      labels: { unit: 'MB' },
    });

    this.recordMetric({
      name: 'system.memory.heapTotal',
      value: Math.round(memUsage.heapTotal / 1024 / 1024),
      type: 'gauge',
      labels: { unit: 'MB' },
    });

    this.recordMetric({
      name: 'system.memory.rss',
      value: Math.round(memUsage.rss / 1024 / 1024),
      type: 'gauge',
      labels: { unit: 'MB' },
    });

    // CPU metrics (approximation)
    const cpuPercentage = ((cpuUsage.user + cpuUsage.system) / 1000000) * 100;
    this.recordMetric({
      name: 'system.cpu.usage',
      value: cpuPercentage,
      type: 'gauge',
      labels: { unit: 'percent' },
    });

    // Load average (Unix systems only)
    if (process.platform !== 'win32') {
      const loadAvg = require('os').loadavg();
      this.recordMetric({
        name: 'system.loadAverage.1min',
        value: loadAvg[0],
        type: 'gauge',
      });
      this.recordMetric({
        name: 'system.loadAverage.5min',
        value: loadAvg[1],
        type: 'gauge',
      });
      this.recordMetric({
        name: 'system.loadAverage.15min',
        value: loadAvg[2],
        type: 'gauge',
      });
    }

    // Process uptime
    this.recordMetric({
      name: 'system.uptime',
      value: process.uptime(),
      type: 'gauge',
      labels: { unit: 'seconds' },
    });
  }

  private collectApplicationMetrics() {
    // These would be populated by other parts of the application
    // For now, we'll record placeholder metrics that can be updated by other services

    this.recordMetric({
      name: 'application.requests.total',
      value: this.getCounterValue('requests_total'),
      type: 'counter',
    });

    this.recordMetric({
      name: 'application.requests.errors',
      value: this.getCounterValue('requests_errors'),
      type: 'counter',
    });

    this.recordMetric({
      name: 'application.devices.connected',
      value: this.getGaugeValue('devices_connected'),
      type: 'gauge',
    });

    this.recordMetric({
      name: 'application.buttons.presses',
      value: this.getCounterValue('button_presses'),
      type: 'counter',
    });
  }

  private getCounterValue(_name: string): number {
    // This would integrate with actual application counters
    return 0;
  }

  private getGaugeValue(_name: string): number {
    // This would integrate with actual application gauges
    return 0;
  }

  private checkAlerts() {
    for (const threshold of this.alertThresholds) {
      const metrics = this.metrics.get(threshold.metric);
      if (!metrics || metrics.length === 0) continue;

      const latestMetric = metrics[metrics.length - 1];
      const alertKey = `${threshold.metric}_${threshold.condition}_${threshold.value}`;
      const currentState = this.alertStates.get(alertKey) || {
        triggered: false,
        since: 0,
      };

      let conditionMet = false;
      switch (threshold.condition) {
        case 'gt':
          conditionMet = latestMetric.value > threshold.value;
          break;
        case 'lt':
          conditionMet = latestMetric.value < threshold.value;
          break;
        case 'eq':
          conditionMet = latestMetric.value === threshold.value;
          break;
      }

      if (conditionMet && !currentState.triggered) {
        // Condition just became true
        this.alertStates.set(alertKey, { triggered: true, since: Date.now() });
      } else if (!conditionMet && currentState.triggered) {
        // Condition resolved
        this.alertStates.set(alertKey, { triggered: false, since: 0 });
        this.emit('alert-resolved', {
          threshold,
          metric: latestMetric,
          duration: Date.now() - currentState.since,
        });
      } else if (conditionMet && currentState.triggered) {
        // Check if duration threshold is met
        const duration = Date.now() - currentState.since;
        if (threshold.duration && duration >= threshold.duration) {
          this.emit('alert', {
            threshold,
            metric: latestMetric,
            duration,
          });

          logger.warn('Alert triggered', {
            metric: threshold.metric,
            condition: `${threshold.condition} ${threshold.value}`,
            currentValue: latestMetric.value,
            severity: threshold.severity,
            duration: `${Math.round(duration / 1000)}s`,
          });
        }
      }
    }
  }

  public getMetrics(metricName?: string, since?: number): Metric[] {
    if (metricName) {
      const metrics = this.metrics.get(metricName) || [];
      return since ? metrics.filter((m) => m.timestamp >= since) : metrics;
    }

    // Return all metrics
    const allMetrics: Metric[] = [];
    for (const metricArray of this.metrics.values()) {
      allMetrics.push(...metricArray);
    }

    const filtered = since
      ? allMetrics.filter((m) => m.timestamp >= since)
      : allMetrics;
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      cpu: {
        usage: ((cpuUsage.user + cpuUsage.system) / 1000000) * 100,
        loadAverage:
          process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
      },
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
    };
  }

  public getApplicationMetrics(): ApplicationMetrics {
    // This would be populated by actual application data
    return {
      requests: {
        total: this.getCounterValue('requests_total'),
        rate: 0,
        errors: this.getCounterValue('requests_errors'),
        errorRate: 0,
      },
      responses: {
        averageTime: 0,
        p95Time: 0,
        p99Time: 0,
      },
      devices: {
        connected: this.getGaugeValue('devices_connected'),
        total: this.getGaugeValue('devices_total'),
        errors: this.getCounterValue('device_errors'),
      },
      buttons: {
        presses: this.getCounterValue('button_presses'),
        errors: this.getCounterValue('button_errors'),
      },
      n8n: {
        requests: this.getCounterValue('n8n_requests'),
        errors: this.getCounterValue('n8n_errors'),
        averageResponseTime: 0,
      },
    };
  }

  public addAlertThreshold(threshold: AlertThreshold) {
    this.alertThresholds.push(threshold);
    logger.info('Alert threshold added', threshold);
  }

  public removeAlertThreshold(
    metric: string,
    condition: string,
    value: number
  ) {
    const index = this.alertThresholds.findIndex(
      (t) =>
        t.metric === metric && t.condition === condition && t.value === value
    );
    if (index !== -1) {
      this.alertThresholds.splice(index, 1);
      logger.info('Alert threshold removed', { metric, condition, value });
    }
  }

  public getAlertThresholds(): AlertThreshold[] {
    return [...this.alertThresholds];
  }

  public getActiveAlerts(): Array<{
    threshold: AlertThreshold;
    since: number;
  }> {
    const activeAlerts: Array<{ threshold: AlertThreshold; since: number }> =
      [];

    for (const [key, state] of this.alertStates.entries()) {
      if (state.triggered) {
        const threshold = this.alertThresholds.find((t) =>
          key.startsWith(`${t.metric}_${t.condition}_${t.value}`)
        );
        if (threshold) {
          activeAlerts.push({ threshold, since: state.since });
        }
      }
    }

    return activeAlerts;
  }

  public clearMetrics(metricName?: string) {
    if (metricName) {
      this.metrics.delete(metricName);
      logger.info('Metrics cleared', { metric: metricName });
    } else {
      this.metrics.clear();
      logger.info('All metrics cleared');
    }
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

// Graceful shutdown
process.on('SIGTERM', () => {
  metricsCollector.stopCollection();
});

process.on('SIGINT', () => {
  metricsCollector.stopCollection();
});

export default metricsCollector;
