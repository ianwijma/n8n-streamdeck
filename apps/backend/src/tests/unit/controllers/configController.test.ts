import { ConfigController } from '../../../controllers/configController';
import { createMockRequest, createMockResponse } from '../../utils/testHelpers';
import { HttpStatusCode, ApiErrorCode, LogLevel } from '@n8n-streamdeck/shared';

describe('ConfigController', () => {
  let controller: ConfigController;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    controller = new ConfigController();
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return current configuration', async () => {
      await controller.getConfig(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            server: expect.objectContaining({
              port: expect.any(Number),
              host: expect.any(String),
            }),
            n8n: expect.objectContaining({
              baseUrl: expect.any(String),
              timeout: expect.any(Number),
            }),
            streamdeck: expect.objectContaining({
              autoConnect: expect.any(Boolean),
              reconnectInterval: expect.any(Number),
            }),
            logging: expect.objectContaining({
              level: expect.any(String),
            }),
          }),
        })
      );
    });

    it('should handle configuration retrieval errors', async () => {
      // Mock an error in the configuration retrieval
      const originalMergeMethod = (controller as any)
        .mergeServerConfigWithAppConfig;
      (controller as any).mergeServerConfigWithAppConfig = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('Configuration error');
        });

      await controller.getConfig(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.INTERNAL_ERROR,
            message: 'Failed to retrieve configuration',
          }),
        })
      );

      // Restore original method
      (controller as any).mergeServerConfigWithAppConfig = originalMergeMethod;
    });
  });

  describe('updateConfig', () => {
    it('should update configuration successfully', async () => {
      mockRequest.body = {
        logging: {
          level: LogLevel.DEBUG,
        },
        streamdeck: {
          autoConnect: false,
        },
      };

      await controller.updateConfig(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Configuration updated successfully',
        })
      );
    });

    it('should return 400 for invalid configuration data', async () => {
      mockRequest.body = null;

      await controller.updateConfig(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Configuration data is required and must be an object',
          }),
        })
      );
    });

    it('should return 400 for configuration validation errors', async () => {
      mockRequest.body = {
        server: {
          port: -1, // Invalid port
        },
      };

      await controller.updateConfig(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Configuration validation failed',
          }),
        })
      );
    });
  });

  describe('getConfigSchema', () => {
    it('should return configuration schema', async () => {
      await controller.getConfigSchema(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            type: 'object',
            properties: expect.objectContaining({
              server: expect.any(Object),
              n8n: expect.any(Object),
              streamdeck: expect.any(Object),
              database: expect.any(Object),
              logging: expect.any(Object),
              features: expect.any(Object),
              images: expect.any(Object),
            }),
          }),
          message: 'Configuration schema retrieved successfully',
        })
      );
    });
  });

  describe('validateConfiguration', () => {
    it('should validate configuration successfully', async () => {
      mockRequest.body = {
        server: {
          port: 3000,
          host: '0.0.0.0',
        },
        n8n: {
          baseUrl: 'http://localhost:5678',
          apiKey: 'test-key',
        },
      };

      await controller.validateConfiguration(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            valid: true,
            errors: [],
            warnings: expect.any(Array),
            suggestions: expect.any(Array),
          }),
          message: 'Configuration is valid',
        })
      );
    });

    it('should return validation errors for invalid configuration', async () => {
      mockRequest.body = {
        server: {
          port: 70000, // Invalid port
        },
        n8n: {
          baseUrl: 'invalid-url',
        },
      };

      await controller.validateConfiguration(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            valid: false,
            errors: expect.arrayContaining([expect.stringContaining('port')]),
          }),
          message: 'Configuration validation failed',
        })
      );
    });

    it('should return warnings for potentially problematic configurations', async () => {
      mockRequest.body = {
        n8n: {
          apiKey: '', // Empty API key should trigger warning
        },
        security: {
          auth: {
            enabled: false, // Disabled auth should trigger warning
          },
        },
      };

      await controller.validateConfiguration(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            warnings: expect.arrayContaining([
              expect.stringContaining('N8N API key is empty'),
              expect.stringContaining('Authentication is disabled'),
            ]),
          }),
        })
      );
    });

    it('should return suggestions for performance configurations', async () => {
      mockRequest.body = {
        logging: {
          level: LogLevel.DEBUG, // Debug logging should trigger suggestion
        },
      };

      await controller.validateConfiguration(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            suggestions: expect.arrayContaining([
              expect.stringContaining(
                'Debug/trace logging may impact performance'
              ),
            ]),
          }),
        })
      );
    });

    it('should return 400 for invalid request body', async () => {
      mockRequest.body = 'invalid';

      await controller.validateConfiguration(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Configuration data is required and must be an object',
          }),
        })
      );
    });
  });

  describe('resetConfig', () => {
    it('should reset configuration to defaults', async () => {
      await controller.resetConfig(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Configuration reset to defaults successfully',
        })
      );
    });
  });

  describe('getConfigHealth', () => {
    it('should return healthy configuration status', async () => {
      await controller.getConfigHealth(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            overall: expect.stringMatching(/^(healthy|unhealthy)$/),
            server: expect.objectContaining({
              valid: expect.any(Boolean),
              errors: expect.any(Array),
            }),
            application: expect.objectContaining({
              valid: expect.any(Boolean),
              errors: expect.any(Array),
            }),
            lastChecked: expect.any(String),
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Mock an internal error
      const originalMethod = (controller as any).mergeServerConfigWithAppConfig;
      (controller as any).mergeServerConfigWithAppConfig = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('Internal error');
        });

      await controller.getConfig(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.INTERNAL_ERROR,
          }),
        })
      );

      // Restore original method
      (controller as any).mergeServerConfigWithAppConfig = originalMethod;
    });
  });
});
