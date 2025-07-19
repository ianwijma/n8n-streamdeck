import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
}

interface RequestMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: number;
  userAgent?: string;
  ip?: string;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private logger: Logger;
  private metrics: PerformanceMetric[] = [];
  private requestMetrics: RequestMetrics[] = [];
  private metricsInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxMetricsAge = 24 * 60 * 60 * 1000; // 24 hours
  private maxMetricsCount = 10000;

  constructor() {
    this.logger = new Logger({ level: config.logLevel }, 'PerformanceMonitor');
    this.startMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private startMonitoring(): void {
    // Collect system metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Cleanup old metrics every hour
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldMetrics();
      },
      60 * 60 * 1000
    );

    this.logger.info('Performance monitoring started');
  }

  private collectSystemMetrics(): void {
    try {
      const memUsage = process.memoryUsage();

      // Memory metrics
      this.recordMetric('memory.heap.used', memUsage.heapUsed, 'bytes');
      this.recordMetric('memory.heap.total', memUsage.heapTotal, 'bytes');
      this.recordMetric('memory.rss', memUsage.rss, 'bytes');
      this.recordMetric('memory.external', memUsage.external, 'bytes');

      // Process uptime
      this.recordMetric('process.uptime', process.uptime(), 'seconds');

      // Event loop metrics
      this.measureEventLoopDelay();
    } catch (error) {
      this.logger.error('Failed to collect system metrics', error as Error);
    }
  }

  private measureEventLoopDelay(): void {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      this.recordMetric('eventloop.delay', delay, 'ms');
    });
  }

  recordMetric(
    name: string,
    value: number,
    unit: string,
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    };

    this.metrics.push(metric);

    // Prevent memory leaks by limiting metrics count
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics = this.metrics.slice(
        -Math.floor(this.maxMetricsCount * 0.8)
      );
    }

    this.logger.debug('Metric recorded', { name, value, unit, tags });
  }

  recordRequestMetric(metric: RequestMetrics): void {
    this.requestMetrics.push(metric);

    // Prevent memory leaks
    if (this.requestMetrics.length > this.maxMetricsCount) {
      this.requestMetrics = this.requestMetrics.slice(
        -Math.floor(this.maxMetricsCount * 0.8)
      );
    }

    // Record as performance metric too
    this.recordMetric('http.request.duration', metric.duration, 'ms', {
      endpoint: metric.endpoint,
      method: metric.method,
      status: metric.statusCode.toString(),
    });
  }

  getMetrics(name?: string, since?: number): PerformanceMetric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter((m) => m.name === name);
    }

    if (since) {
      filtered = filtered.filter((m) => m.timestamp >= since);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  getRequestMetrics(since?: number): RequestMetrics[] {
    let filtered = this.requestMetrics;

    if (since) {
      filtered = filtered.filter((m) => m.timestamp >= since);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  getLatestMetric(name: string): PerformanceMetric | null {
    const metrics = this.getMetrics(name);
    return metrics.length > 0 ? metrics[0] : null;
  }

  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    checks: Record<
      string,
      { status: string; value?: number; threshold?: number }
    >;
  } {
    const checks: Record<
      string,
      { status: string; value?: number; threshold?: number }
    > = {};

    // Memory check
    const memUsage = process.memoryUsage();
    const memoryUsage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    checks.memory = {
      status:
        memoryUsage > 90
          ? 'critical'
          : memoryUsage > 75
            ? 'warning'
            : 'healthy',
      value: memoryUsage,
      threshold: 90,
    };

    // Event loop delay check
    const eventLoopMetric = this.getLatestMetric('eventloop.delay');
    const eventLoopDelay = eventLoopMetric?.value || 0;
    checks.eventLoop = {
      status:
        eventLoopDelay > 100
          ? 'critical'
          : eventLoopDelay > 50
            ? 'warning'
            : 'healthy',
      value: eventLoopDelay,
      threshold: 100,
    };

    // Overall status
    const statuses = Object.values(checks).map((c) => c.status);
    const overallStatus = statuses.includes('critical')
      ? 'critical'
      : statuses.includes('warning')
        ? 'warning'
        : 'healthy';

    return { status: overallStatus, checks };
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.maxMetricsAge;

    const oldMetricsCount = this.metrics.length;
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoff);

    const oldRequestMetricsCount = this.requestMetrics.length;
    this.requestMetrics = this.requestMetrics.filter(
      (m) => m.timestamp >= cutoff
    );

    const metricsRemoved = oldMetricsCount - this.metrics.length;
    const requestMetricsRemoved =
      oldRequestMetricsCount - this.requestMetrics.length;

    if (metricsRemoved > 0 || requestMetricsRemoved > 0) {
      this.logger.debug('Cleaned up old metrics', {
        metricsRemoved,
        requestMetricsRemoved,
        remainingMetrics: this.metrics.length,
        remainingRequestMetrics: this.requestMetrics.length,
      });
    }
  }

  // Express middleware for request monitoring
  getRequestMiddleware() {
    return (req: any, res: any, next: any) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;

        this.recordRequestMetric({
          endpoint: req.route?.path || req.path,
          method: req.method,
          statusCode: res.statusCode,
          duration,
          timestamp: start,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
      });

      next();
    };
  }

  shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.logger.info('Performance monitoring stopped');
  }
}

// Singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
