import express, { Application } from 'express';
import { Logger } from '@n8n-streamdeck/shared';
import { config, validateConfig } from './config/environment';

// Middleware imports
import { corsMiddleware } from './middleware/cors';
import {
  requestIdMiddleware,
  requestLoggingMiddleware,
  errorLoggingMiddleware,
} from './middleware/logging';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Route imports
import healthRoutes from './routes/health';
import devicesRoutes from './routes/devices';
import buttonsRoutes from './routes/buttons';
import deviceButtonsRoutes from './routes/deviceButtons';
import configRoutes from './routes/config';

const logger = new Logger({ level: config.logLevel }, 'App');

export const createApp = (): Application => {
  // Validate configuration
  const configValidation = validateConfig();
  if (!configValidation.valid) {
    logger.error(
      'Invalid configuration',
      new Error('Configuration validation failed'),
      {
        errors: configValidation.errors,
      }
    );
    process.exit(1);
  }

  const app = express();

  // Trust proxy (for proper IP addresses behind reverse proxies)
  app.set('trust proxy', true);

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Request ID middleware (must be first)
  app.use(requestIdMiddleware);

  // CORS middleware
  app.use(corsMiddleware);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware
  app.use(requestLoggingMiddleware);

  // Health check endpoint (before other routes for quick access)
  app.use('/health', healthRoutes);
  app.use('/api/health', healthRoutes);

  // API routes
  app.use('/api/devices', devicesRoutes);
  app.use('/api/buttons', buttonsRoutes);
  app.use('/api/config', configRoutes);

  // Device-specific button routes (proper REST structure)
  app.use('/api/devices/:deviceId/buttons', deviceButtonsRoutes);
  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: '@n8n-streamdeck/backend',
      version: process.env.npm_package_version || '1.0.0',
      description: 'Backend service for N8N StreamDeck integration',
      status: 'running',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        api: {
          devices: '/api/devices',
          buttons: '/api/buttons',
          config: '/api/config',
          health: '/api/health',
        },
      },
    });
  });

  // Error logging middleware
  app.use(errorLoggingMiddleware);

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  logger.info('Express application created successfully', {
    nodeEnv: config.nodeEnv,
    logLevel: config.logLevel,
    corsOrigins: config.corsOrigins,
  });

  return app;
};

export default createApp;
