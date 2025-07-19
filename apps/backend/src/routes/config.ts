import { Router, Request, Response } from 'express';
import { 
  createSuccessResponse,
  Logger,
  AppConfig,
  LogLevel
} from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { asyncHandler, createValidationError } from '../middleware/errorHandler';

const router = Router();
const logger = new Logger({ level: config.logLevel }, 'ConfigRoute');

// GET /api/config - Get current configuration (sanitized)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching application configuration', {
    requestId: req.requestId,
  });

  // Return sanitized configuration (no sensitive data)
  const sanitizedConfig = {
    server: {
      port: config.port,
      host: config.host,
      nodeEnv: config.nodeEnv,
      corsOrigins: config.corsOrigins,
    },
    logging: {
      level: config.logLevel,
    },
    n8n: {
      baseUrl: config.n8n.baseUrl,
      timeout: config.n8n.timeout,
      configured: !!config.n8n.apiKey, // Don't expose the actual API key
    },
    streamdeck: {
      autoConnect: config.streamdeck.autoConnect,
      reconnectInterval: config.streamdeck.reconnectInterval,
    },
    features: {
      healthCheck: true,
      apiDocumentation: true,
      requestLogging: true,
      errorHandling: true,
    },
  };

  const response = createSuccessResponse(
    sanitizedConfig,
    'Configuration retrieved successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// GET /api/config/environment - Get environment information
router.get('/environment', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching environment information', {
    requestId: req.requestId,
  });

  const environmentInfo = {
    nodeEnv: config.nodeEnv,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    cpu: process.cpuUsage(),
    loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
  };

  const response = createSuccessResponse(
    environmentInfo,
    'Environment information retrieved successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// PUT /api/config/logging - Update logging configuration
router.put('/logging', asyncHandler(async (req: Request, res: Response) => {
  const { level } = req.body;
  
  logger.info('Updating logging configuration', {
    requestId: req.requestId,
    newLevel: level,
    currentLevel: config.logLevel,
  });

  // Validate log level
  const validLevels = Object.values(LogLevel);
  if (!validLevels.includes(level)) {
    throw createValidationError(`Invalid log level. Must be one of: ${validLevels.join(', ')}`);
  }

  // Update log level (in a real app, this might persist to a config file or database)
  config.logLevel = level;
  
  // Update logger instances (this is a simplified approach)
  logger.updateConfig({ level });

  const response = createSuccessResponse(
    { level: config.logLevel },
    'Logging configuration updated successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// GET /api/config/n8n - Get N8N configuration status
router.get('/n8n', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching N8N configuration status', {
    requestId: req.requestId,
  });

  const n8nConfig = {
    baseUrl: config.n8n.baseUrl,
    timeout: config.n8n.timeout,
    configured: !!config.n8n.apiKey,
    connectionStatus: 'unknown', // TODO: Implement actual connection check
  };

  const response = createSuccessResponse(
    n8nConfig,
    'N8N configuration retrieved successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// PUT /api/config/n8n - Update N8N configuration
router.put('/n8n', asyncHandler(async (req: Request, res: Response) => {
  const { baseUrl, timeout } = req.body;
  
  logger.info('Updating N8N configuration', {
    requestId: req.requestId,
    baseUrl,
    timeout,
  });

  // Validate base URL
  if (baseUrl) {
    try {
      new URL(baseUrl);
      config.n8n.baseUrl = baseUrl;
    } catch {
      throw createValidationError('baseUrl must be a valid URL');
    }
  }

  // Validate timeout
  if (timeout !== undefined) {
    if (typeof timeout !== 'number' || timeout < 1000) {
      throw createValidationError('timeout must be a number >= 1000ms');
    }
    config.n8n.timeout = timeout;
  }

  const updatedConfig = {
    baseUrl: config.n8n.baseUrl,
    timeout: config.n8n.timeout,
    configured: !!config.n8n.apiKey,
  };

  const response = createSuccessResponse(
    updatedConfig,
    'N8N configuration updated successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// GET /api/config/streamdeck - Get StreamDeck configuration
router.get('/streamdeck', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching StreamDeck configuration', {
    requestId: req.requestId,
  });

  const streamdeckConfig = {
    autoConnect: config.streamdeck.autoConnect,
    reconnectInterval: config.streamdeck.reconnectInterval,
    connectionStatus: 'unknown', // TODO: Implement actual connection check
  };

  const response = createSuccessResponse(
    streamdeckConfig,
    'StreamDeck configuration retrieved successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// PUT /api/config/streamdeck - Update StreamDeck configuration
router.put('/streamdeck', asyncHandler(async (req: Request, res: Response) => {
  const { autoConnect, reconnectInterval } = req.body;
  
  logger.info('Updating StreamDeck configuration', {
    requestId: req.requestId,
    autoConnect,
    reconnectInterval,
  });

  // Validate autoConnect
  if (autoConnect !== undefined) {
    if (typeof autoConnect !== 'boolean') {
      throw createValidationError('autoConnect must be a boolean');
    }
    config.streamdeck.autoConnect = autoConnect;
  }

  // Validate reconnectInterval
  if (reconnectInterval !== undefined) {
    if (typeof reconnectInterval !== 'number' || reconnectInterval < 1000) {
      throw createValidationError('reconnectInterval must be a number >= 1000ms');
    }
    config.streamdeck.reconnectInterval = reconnectInterval;
  }

  const updatedConfig = {
    autoConnect: config.streamdeck.autoConnect,
    reconnectInterval: config.streamdeck.reconnectInterval,
  };

  const response = createSuccessResponse(
    updatedConfig,
    'StreamDeck configuration updated successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

// GET /api/config/version - Get application version information
router.get('/version', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Fetching version information', {
    requestId: req.requestId,
  });

  const versionInfo = {
    version: process.env.npm_package_version || '1.0.0',
    name: process.env.npm_package_name || '@n8n-streamdeck/backend',
    description: process.env.npm_package_description || 'Backend service for N8N StreamDeck integration',
    nodeVersion: process.version,
    buildDate: new Date().toISOString(), // In a real app, this would be set during build
    gitCommit: process.env.GIT_COMMIT || 'unknown',
    gitBranch: process.env.GIT_BRANCH || 'unknown',
  };

  const response = createSuccessResponse(
    versionInfo,
    'Version information retrieved successfully',
    req.requestId
  );

  res.status(200).json(response);
}));

export default router;