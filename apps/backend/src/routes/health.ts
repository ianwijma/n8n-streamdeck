import { Router, Request, Response } from 'express';
import {
  createSuccessResponse,
  HealthCheckResponse,
  Logger,
} from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { asyncHandler } from '../middleware/errorHandler';
import { performanceMonitor } from '../services/performanceMonitor';
import { cacheService } from '../services/cacheService';
import { StreamDeckService } from '../services/streamDeckService';

const router = Router();
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

export default router;
