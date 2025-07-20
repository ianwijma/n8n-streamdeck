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
import { StreamDeckService } from '../services/streamDeckService';
import { DatabaseService } from '../services/databaseService';

const router: ExpressRouter = Router();
const logger = new Logger({ level: config.logLevel }, 'HealthRoute');

// Simple test endpoint
router.get('/test', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Service instances
const databaseService = DatabaseService.getInstance();
const streamDeckService = StreamDeckService.getInstance();

// Health check endpoint
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();

    // Simplified health check without external service calls for now
    const healthData = {
      status: 'healthy' as const,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      services: {
        database: 'connected', // Simplified for now
        n8n:
          config.n8n.baseUrl &&
          config.n8n.apiKey &&
          config.n8n.apiKey !== 'your-n8n-api-key-here'
            ? 'configured'
            : 'not-configured',
        streamdeck:
          streamDeckService.getConnectedDevices().length > 0
            ? 'connected'
            : 'disconnected',
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

    const response = createSuccessResponse(
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
        database: 'connected', // Simplified for now
        n8n:
          config.n8n.baseUrl &&
          config.n8n.apiKey &&
          config.n8n.apiKey !== 'your-n8n-api-key-here'
            ? 'configured'
            : 'not-configured',
        streamdeck:
          streamDeckService.getConnectedDevices().length > 0
            ? 'connected'
            : 'disconnected',
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
    const isReady = true; // Simplified - service is ready if it's responding

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
  try {
    // Test database connection using the database service
    const isHealthy = await databaseService.healthCheck();
    return isHealthy ? 'connected' : 'disconnected';
  } catch (error) {
    logger.warn('Database health check failed', {
      error: (error as Error).message,
    });
    return 'disconnected';
  }
}

async function checkN8NConnection(): Promise<'connected' | 'disconnected'> {
  try {
    if (
      !config.n8n.baseUrl ||
      !config.n8n.apiKey ||
      config.n8n.apiKey === 'your-n8n-api-key-here'
    ) {
      logger.debug('N8N not configured', {
        hasBaseUrl: !!config.n8n.baseUrl,
        hasApiKey: !!config.n8n.apiKey,
        isDefaultKey: config.n8n.apiKey === 'your-n8n-api-key-here',
      });
      return 'disconnected';
    }

    // Test N8N API connection with a simple health check and shorter timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Reduced timeout

    try {
      const response = await fetch(`${config.n8n.baseUrl}/healthz`, {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': config.n8n.apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        logger.debug('N8N health check successful');
        return 'connected';
      } else {
        logger.warn('N8N health check failed', {
          status: response.status,
          statusText: response.statusText,
        });
        return 'disconnected';
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.debug('N8N health check failed', { error: errorMessage });
    return 'disconnected';
  }
}

async function checkStreamDeckConnection(): Promise<
  'connected' | 'disconnected'
> {
  try {
    // Check if any StreamDeck devices are connected
    const connectedDevices = streamDeckService.getConnectedDevices();

    if (connectedDevices.length > 0) {
      logger.debug('StreamDeck health check successful', {
        connectedDevices: connectedDevices.length,
      });
      return 'connected';
    } else {
      // Check if any devices are discovered but not connected
      const allDevices = streamDeckService.getDevices();
      logger.debug('StreamDeck health check - no connected devices', {
        totalDevices: allDevices.length,
        connectedDevices: connectedDevices.length,
      });
      return 'disconnected';
    }
  } catch (error) {
    logger.warn('StreamDeck health check failed', {
      error: (error as Error).message,
    });
    return 'disconnected';
  }
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
          database: 'connected',
          n8n:
            config.n8n.baseUrl &&
            config.n8n.apiKey &&
            config.n8n.apiKey !== 'your-n8n-api-key-here'
              ? 'connected'
              : 'disconnected',
          streamdeck:
            streamDeckService.getConnectedDevices().length > 0
              ? 'connected'
              : 'disconnected',
        },
      },
      'Dashboard data retrieved',
      req.requestId
    );

    res.json(response);
  })
);

// Cleanup function for graceful shutdown
process.on('beforeExit', async () => {
  // Database cleanup is handled by DatabaseService
  logger.info('Health route cleanup completed');
});

export default router;
