import { Request, Response } from 'express';
import {
  createSuccessResponse,
  createErrorResponse,
  ApiErrorCode,
  HttpStatusCode,
  Logger,
  AppConfig,
  DEFAULT_CONFIG,
  mergeConfig,
  validateConfig as validateAppConfig,
} from '@n8n-streamdeck/shared';
import { config, validateConfig } from '../config/environment';

const logger = new Logger({ level: config.logLevel }, 'ConfigController');

// In-memory configuration storage for demo purposes
// In a real application, this would be stored in a database or configuration file
let currentAppConfig: AppConfig = { ...DEFAULT_CONFIG };

export class ConfigController {
  /**
   * GET /config - Get application configuration
   */
  async getConfig(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Fetching application configuration', {
        requestId: req.requestId,
      });

      // Merge current server config with app config
      const fullConfig = this.mergeServerConfigWithAppConfig();

      const response = createSuccessResponse(
        fullConfig,
        'Configuration retrieved successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to get configuration', error as Error, {
        requestId: req.requestId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to retrieve configuration',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * PUT /config - Update application configuration
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const configUpdate = req.body;

      if (!configUpdate || typeof configUpdate !== 'object') {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Configuration data is required and must be an object',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Updating application configuration', {
        requestId: req.requestId,
        updateKeys: Object.keys(configUpdate),
      });

      // Validate the configuration update
      const validation = validateAppConfig(configUpdate);
      if (!validation.valid) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Configuration validation failed',
            details: { errors: validation.errors },
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Merge with current configuration
      const updatedConfig = mergeConfig(currentAppConfig, configUpdate);

      // Validate the merged configuration
      const mergedValidation = validateAppConfig(updatedConfig);
      if (!mergedValidation.valid) {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Merged configuration validation failed',
            details: { errors: mergedValidation.errors },
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      // Update the current configuration
      currentAppConfig = updatedConfig;

      // Merge with server config for response
      const fullConfig = this.mergeServerConfigWithAppConfig();

      const response = createSuccessResponse(
        fullConfig,
        'Configuration updated successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to update configuration', error as Error, {
        requestId: req.requestId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to update configuration',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * GET /config/schema - Get configuration schema
   */
  async getConfigSchema(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Fetching configuration schema', {
        requestId: req.requestId,
      });

      const schema = {
        type: 'object',
        properties: {
          server: {
            type: 'object',
            properties: {
              port: { type: 'number', minimum: 1, maximum: 65535 },
              host: { type: 'string' },
              cors: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  origins: { type: 'array', items: { type: 'string' } },
                },
              },
              rateLimit: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  windowMs: { type: 'number', minimum: 1000 },
                  maxRequests: { type: 'number', minimum: 1 },
                },
              },
            },
          },
          n8n: {
            type: 'object',
            properties: {
              baseUrl: { type: 'string', format: 'uri' },
              apiKey: { type: 'string' },
              webhookUrl: { type: 'string', format: 'uri' },
              timeout: { type: 'number', minimum: 1000 },
              retryAttempts: { type: 'number', minimum: 0 },
              retryDelay: { type: 'number', minimum: 100 },
            },
            required: ['baseUrl', 'apiKey'],
          },
          streamdeck: {
            type: 'object',
            properties: {
              autoConnect: { type: 'boolean' },
              reconnectInterval: { type: 'number', minimum: 1000 },
              maxReconnectAttempts: { type: 'number', minimum: 0 },
              buttonPressTimeout: { type: 'number', minimum: 100 },
              longPressThreshold: { type: 'number', minimum: 100 },
              doublePressThreshold: { type: 'number', minimum: 50 },
            },
          },
          database: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['sqlite', 'postgresql', 'mysql'] },
              host: { type: 'string' },
              port: { type: 'number', minimum: 1, maximum: 65535 },
              database: { type: 'string' },
              username: { type: 'string' },
              password: { type: 'string' },
              ssl: { type: 'boolean' },
              connectionTimeout: { type: 'number', minimum: 1000 },
              maxConnections: { type: 'number', minimum: 1 },
            },
            required: ['type', 'database'],
          },
          logging: {
            type: 'object',
            properties: {
              level: {
                type: 'string',
                enum: ['error', 'warn', 'info', 'debug', 'trace'],
              },
              format: { type: 'string', enum: ['json', 'text'] },
              file: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  path: { type: 'string' },
                  maxSize: { type: 'string' },
                  maxFiles: { type: 'number', minimum: 1 },
                },
              },
              console: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  colorize: { type: 'boolean' },
                },
              },
            },
          },
          features: {
            type: 'object',
            properties: {
              webInterface: { type: 'boolean' },
              apiDocumentation: { type: 'boolean' },
              metrics: { type: 'boolean' },
              healthCheck: { type: 'boolean' },
              deviceDiscovery: { type: 'boolean' },
              profileSync: { type: 'boolean' },
            },
          },
          images: {
            type: 'object',
            properties: {
              maxSize: { type: 'number', minimum: 1024 },
              allowedFormats: { type: 'array', items: { type: 'string' } },
              quality: { type: 'number', minimum: 1, maximum: 100 },
              cacheEnabled: { type: 'boolean' },
              cacheTtl: { type: 'number', minimum: 60 },
            },
          },
        },
      };

      const response = createSuccessResponse(
        schema,
        'Configuration schema retrieved successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to get configuration schema', error as Error, {
        requestId: req.requestId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to retrieve configuration schema',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * POST /config/validate - Validate configuration
   */
  async validateConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const configToValidate = req.body;

      if (!configToValidate || typeof configToValidate !== 'object') {
        const errorResponse = createErrorResponse(
          {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Configuration data is required and must be an object',
          },
          req.requestId
        );
        res.status(HttpStatusCode.BAD_REQUEST).json(errorResponse);
        return;
      }

      logger.info('Validating configuration', {
        requestId: req.requestId,
        configKeys: Object.keys(configToValidate),
      });

      // Validate the configuration
      const validation = validateAppConfig(configToValidate);

      const validationResult = {
        valid: validation.valid,
        errors: validation.errors,
        warnings: [] as string[],
        suggestions: [] as string[],
      };

      // Add warnings and suggestions
      if (configToValidate.n8n?.apiKey === '') {
        validationResult.warnings.push(
          'N8N API key is empty - some features may not work'
        );
      }

      if (configToValidate.security?.auth?.enabled === false) {
        validationResult.warnings.push(
          'Authentication is disabled - consider enabling for production'
        );
      }

      if (
        configToValidate.logging?.level === 'debug' ||
        configToValidate.logging?.level === 'trace'
      ) {
        validationResult.suggestions.push(
          'Debug/trace logging may impact performance in production'
        );
      }

      const response = createSuccessResponse(
        validationResult,
        validation.valid
          ? 'Configuration is valid'
          : 'Configuration validation failed',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to validate configuration', error as Error, {
        requestId: req.requestId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to validate configuration',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * POST /config/reset - Reset configuration to defaults
   */
  async resetConfig(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Resetting configuration to defaults', {
        requestId: req.requestId,
      });

      // Reset to default configuration
      currentAppConfig = { ...DEFAULT_CONFIG };

      // Merge with server config for response
      const fullConfig = this.mergeServerConfigWithAppConfig();

      const response = createSuccessResponse(
        fullConfig,
        'Configuration reset to defaults successfully',
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to reset configuration', error as Error, {
        requestId: req.requestId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to reset configuration',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * GET /config/health - Get configuration health status
   */
  async getConfigHealth(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Checking configuration health', {
        requestId: req.requestId,
      });

      const serverValidation = validateConfig();
      const appValidation = validateAppConfig(currentAppConfig);

      const health = {
        overall:
          serverValidation.valid && appValidation.valid
            ? 'healthy'
            : 'unhealthy',
        server: {
          valid: serverValidation.valid,
          errors: serverValidation.errors,
        },
        application: {
          valid: appValidation.valid,
          errors: appValidation.errors,
        },
        lastChecked: new Date().toISOString(),
      };

      const response = createSuccessResponse(
        health,
        `Configuration is ${health.overall}`,
        req.requestId
      );

      res.status(HttpStatusCode.OK).json(response);
    } catch (error) {
      logger.error('Failed to check configuration health', error as Error, {
        requestId: req.requestId,
      });

      const errorResponse = createErrorResponse(
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to check configuration health',
          details: { error: (error as Error).message },
        },
        req.requestId
      );

      res.status(HttpStatusCode.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Merge server configuration with app configuration
   */
  private mergeServerConfigWithAppConfig(): AppConfig {
    return mergeConfig(currentAppConfig, {
      server: {
        port: config.port,
        host: config.host,
        cors: {
          enabled: true,
          origins: config.corsOrigins,
        },
        rateLimit: currentAppConfig.server.rateLimit,
      },
      n8n: {
        baseUrl: config.n8n.baseUrl,
        apiKey: config.n8n.apiKey,
        timeout: config.n8n.timeout,
        retryAttempts: currentAppConfig.n8n.retryAttempts,
        retryDelay: currentAppConfig.n8n.retryDelay,
      },
      streamdeck: {
        autoConnect: config.streamdeck.autoConnect,
        reconnectInterval: config.streamdeck.reconnectInterval,
        maxReconnectAttempts: currentAppConfig.streamdeck.maxReconnectAttempts,
        buttonPressTimeout: currentAppConfig.streamdeck.buttonPressTimeout,
        longPressThreshold: currentAppConfig.streamdeck.longPressThreshold,
        doublePressThreshold: currentAppConfig.streamdeck.doublePressThreshold,
      },
      logging: {
        level: config.logLevel,
        format: currentAppConfig.logging.format,
        file: currentAppConfig.logging.file,
        console: currentAppConfig.logging.console,
      },
    });
  }
}
