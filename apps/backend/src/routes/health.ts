import {
  Router,
  Request,
  Response,
  type Router as ExpressRouter,
} from 'express';
import {
  createSuccessResponse,
  HealthCheckResponse,
  Logger,
} from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { asyncHandler } from '../middleware/errorHandler';
import { performanceMonitor } from '../services/performanceMonitor';
import { metricsCollector } from '../services/metricsCollector';

const router: ExpressRouter = Router();
const logger = new Logger({ level: config.logLevel }, 'HealthRoute');

// Health check endpoint
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();

    // Basic health checks
    const healthData = {
      status: 'healthy' as const,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      services: {
        database: 'connected' as const, // TODO: Implement actual database check
        n8n: await checkN8NConnection(),
        streamdeck: 'connected' as const, // TODO: Implement actual StreamDeck check
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
        },
        cpu: process.cpuUsage(),
      },
    };

    const responseTime = Date.now() - startTime;

    logger.info('Health check completed', {
      requestId: req.requestId,
      responseTime: `${responseTime}ms`,
      status: healthData.status,
    });

    const response: HealthCheckResponse = createSuccessResponse(
      healthData,
      'Service is healthy',
      req.requestId
    );

    res.status(200).json(response);
  })
);

// Detailed health check endpoint
router.get(
  '/detailed',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();

    // More comprehensive health checks
    const detailedHealth = {
      status: 'healthy' as const,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      config: {
        port: config.port,
        host: config.host,
        logLevel: config.logLevel,
        corsOrigins: config.corsOrigins,
        n8nConfigured: !!config.n8n.apiKey,
      },
      services: {
        database: await checkDatabaseConnection(),
        n8n: await checkN8NConnection(),
        streamdeck: await checkStreamDeckConnection(),
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
        cpu: process.cpuUsage(),
        loadAverage:
          process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
      },
      checks: {
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };

    const response = createSuccessResponse(
      detailedHealth,
      'Detailed health check completed',
      req.requestId
    );

    res.status(200).json(response);
  })
);

// Readiness probe (for Kubernetes)
router.get(
  '/ready',
  asyncHandler(async (req: Request, res: Response) => {
    // Check if all critical services are ready
    const n8nStatus = await checkN8NConnection();
    const isReady = n8nStatus === 'connected';

    if (isReady) {
      res
        .status(200)
        .json(
          createSuccessResponse(
            { ready: true, timestamp: new Date().toISOString() },
            'Service is ready',
            req.requestId
          )
        );
    } else {
      res
        .status(503)
        .json(
          createSuccessResponse(
            { ready: false, timestamp: new Date().toISOString() },
            'Service is not ready',
            req.requestId
          )
        );
    }
  })
);

// Liveness probe (for Kubernetes)
router.get(
  '/live',
  asyncHandler(async (req: Request, res: Response) => {
    // Simple liveness check
    res
      .status(200)
      .json(
        createSuccessResponse(
          { alive: true, timestamp: new Date().toISOString() },
          'Service is alive',
          req.requestId
        )
      );
  })
);

// Helper functions for service checks
async function checkDatabaseConnection(): Promise<
  'connected' | 'disconnected'
> {
  // TODO: Implement actual database connection check
  // For now, return connected as placeholder
  return 'connected';
}

async function checkN8NConnection(): Promise<'connected' | 'disconnected'> {
  try {
    if (!config.n8n.baseUrl || !config.n8n.apiKey) {
      return 'disconnected';
    }

    // TODO: Implement actual N8N API health check
    // const response = await fetch(`${config.n8n.baseUrl}/api/v1/workflows`, {
    //   headers: { 'X-N8N-API-KEY': config.n8n.apiKey },
    //   timeout: 5000,
    // });
    // return response.ok ? 'connected' : 'disconnected';

    return 'connected'; // Placeholder
  } catch (error) {
    logger.warn('N8N health check failed', { error: (error as Error).message });
    return 'disconnected';
  }
}

async function checkStreamDeckConnection(): Promise<
  'connected' | 'disconnected'
> {
  // TODO: Implement actual StreamDeck connection check
  return 'connected';
}

// Performance metrics endpoint
router.get(
  '/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    const since = req.query.since
      ? parseInt(req.query.since as string)
      : undefined;
    const name = req.query.name as string;

    const metrics = performanceMonitor.getMetrics(name, since);
    const requestMetrics = performanceMonitor.getRequestMetrics(since);

    const response = createSuccessResponse(
      {
        timestamp: new Date().toISOString(),
        metrics: metrics.slice(0, 100), // Limit to last 100 metrics
        requestMetrics: requestMetrics.slice(0, 100),
        summary: {
          totalMetrics: metrics.length,
          totalRequests: requestMetrics.length,
          timeRange: since
            ? `Last ${Math.round((Date.now() - since) / 1000)}s`
            : 'All time',
        },
      },
      'Performance metrics retrieved',
      req.requestId
    );

    res.json(response);
  })
);

// System metrics endpoint
router.get(
  '/system',
  asyncHandler(async (req: Request, res: Response) => {
    const systemMetrics = metricsCollector.getSystemMetrics();
    const applicationMetrics = metricsCollector.getApplicationMetrics();

    const response = createSuccessResponse(
      {
        timestamp: new Date().toISOString(),
        system: systemMetrics,
        application: applicationMetrics,
      },
      'System metrics retrieved',
      req.requestId
    );

    res.json(response);
  })
);

// Alerts endpoint
router.get(
  '/alerts',
  asyncHandler(async (req: Request, res: Response) => {
    const activeAlerts = metricsCollector.getActiveAlerts();
    const alertThresholds = metricsCollector.getAlertThresholds();

    const response = createSuccessResponse(
      {
        timestamp: new Date().toISOString(),
        activeAlerts: activeAlerts.map((alert) => ({
          ...alert.threshold,
          triggeredAt: new Date(alert.since).toISOString(),
          duration: Date.now() - alert.since,
        })),
        thresholds: alertThresholds,
        summary: {
          totalAlerts: activeAlerts.length,
          criticalAlerts: activeAlerts.filter(
            (a) => a.threshold.severity === 'critical'
          ).length,
          highAlerts: activeAlerts.filter(
            (a) => a.threshold.severity === 'high'
          ).length,
          mediumAlerts: activeAlerts.filter(
            (a) => a.threshold.severity === 'medium'
          ).length,
          lowAlerts: activeAlerts.filter((a) => a.threshold.severity === 'low')
            .length,
        },
      },
      'Alert status retrieved',
      req.requestId
    );

    res.json(response);
  })
);

// Dashboard endpoint - comprehensive status
router.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    const systemMetrics = metricsCollector.getSystemMetrics();
    const applicationMetrics = metricsCollector.getApplicationMetrics();
    const activeAlerts = metricsCollector.getActiveAlerts();
    const since = Date.now() - 300000; // Last 5 minutes
    const recentMetrics = metricsCollector.getMetrics(undefined, since);

    // Calculate health score based on various factors
    let healthScore = 100;

    // Deduct points for high resource usage
    if (systemMetrics.memory.percentage > 85) healthScore -= 20;
    if (systemMetrics.cpu.usage > 90) healthScore -= 20;

    // Deduct points for active alerts
    healthScore -= activeAlerts.length * 10;

    // Deduct points for error rates
    if (applicationMetrics.requests.errorRate > 5) healthScore -= 15;

    healthScore = Math.max(0, healthScore);

    const status =
      healthScore >= 80
        ? 'healthy'
        : healthScore >= 60
          ? 'degraded'
          : healthScore >= 40
            ? 'unhealthy'
            : 'critical';

    const response = createSuccessResponse(
      {
        timestamp: new Date().toISOString(),
        status,
        healthScore,
        uptime: process.uptime(),
        system: systemMetrics,
        application: applicationMetrics,
        alerts: {
          active: activeAlerts.length,
          critical: activeAlerts.filter(
            (a) => a.threshold.severity === 'critical'
          ).length,
          recent: recentMetrics.filter((m) => m.name.includes('alert')).length,
        },
        performance: {
          responseTime: Date.now() - Date.now(), // This would be calculated properly
          throughput: applicationMetrics.requests.rate,
          errorRate: applicationMetrics.requests.errorRate,
        },
        services: {
          database: await checkDatabaseConnection(),
          n8n: await checkN8NConnection(),
          streamdeck: await checkStreamDeckConnection(),
        },
      },
      'Dashboard data retrieved',
      req.requestId
    );

    res.json(response);
  })
);

export default router;
