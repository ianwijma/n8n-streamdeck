import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../app';
import {
  ApiTestHelper,
  expectSuccessResponse,
  expectErrorResponse,
  expectPaginatedResponse,
} from '../utils/testHelpers';

// Mock the StreamDeck module
jest.mock('@elgato-stream-deck/node');

describe('API Integration Tests', () => {
  let app: Application;
  let apiHelper: ApiTestHelper;

  beforeAll(() => {
    app = createApp();
    apiHelper = new ApiTestHelper();
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expectSuccessResponse(response);
      expect(response.body.data).toMatchObject({
        status: 'healthy',
        uptime: expect.any(Number),
        version: expect.any(String),
        environment: 'test',
        services: expect.objectContaining({
          database: expect.any(String),
          n8n: expect.any(String),
          streamdeck: expect.any(String),
        }),
      });
    });

    it('should return API health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expectSuccessResponse(response);
    });
  });

  describe('Device API Integration', () => {
    describe('GET /api/devices', () => {
      it('should list devices with pagination', async () => {
        const response = await apiHelper.getDevices();

        expect(response.status).toBe(200);
        expectPaginatedResponse(response);
        expect(response.body.data).toBeInstanceOf(Array);
      });

      it('should filter disconnected devices', async () => {
        const response = await apiHelper.getDevices({
          includeDisconnected: 'false',
        });

        expect(response.status).toBe(200);
        expectSuccessResponse(response);
      });

      it('should handle pagination parameters', async () => {
        const response = await apiHelper.getDevices({ page: '1', limit: '5' });

        expect(response.status).toBe(200);
        expectPaginatedResponse(response);
        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(5);
      });
    });

    describe('GET /api/devices/:id', () => {
      it('should return 404 for non-existent device', async () => {
        const response = await apiHelper.getDevice('non-existent-device');

        expect(response.status).toBe(404);
        expectErrorResponse(response, 'NOT_FOUND');
      });
    });

    describe('POST /api/devices/:id/connect', () => {
      it('should return 404 for non-existent device', async () => {
        const response = await apiHelper.connectDevice('non-existent-device');

        expect(response.status).toBe(404);
        expectErrorResponse(response, 'NOT_FOUND');
      });
    });

    describe('DELETE /api/devices/:id', () => {
      it('should return 404 for non-existent device', async () => {
        const response = await apiHelper.disconnectDevice(
          'non-existent-device'
        );

        expect(response.status).toBe(404);
        expectErrorResponse(response, 'NOT_FOUND');
      });
    });

    describe('GET /api/devices/:id/status', () => {
      it('should return 404 for non-existent device', async () => {
        const response = await apiHelper.getDeviceStatus('non-existent-device');

        expect(response.status).toBe(404);
        expectErrorResponse(response, 'NOT_FOUND');
      });
    });

    describe('PUT /api/devices/:id/brightness', () => {
      it('should return 400 for invalid brightness', async () => {
        const response = await apiHelper.updateDeviceBrightness(
          'device-1',
          150
        );

        expect(response.status).toBe(400);
        expectErrorResponse(response, 'VALIDATION_ERROR');
      });

      it('should return 404 for non-existent device', async () => {
        const response = await apiHelper.updateDeviceBrightness(
          'non-existent-device',
          50
        );

        expect(response.status).toBe(404);
        expectErrorResponse(response, 'NOT_FOUND');
      });
    });
  });

  describe('Button API Integration', () => {
    describe('GET /api/devices/:deviceId/buttons', () => {
      it('should return 404 for non-existent device', async () => {
        const response = await apiHelper.getButtons('non-existent-device');

        expect(response.status).toBe(404);
        expectErrorResponse(response, 'NOT_FOUND');
      });
    });

    describe('POST /api/devices/:deviceId/buttons', () => {
      it('should return 400 for invalid button data', async () => {
        const response = await apiHelper.createButton('device-1', {
          index: -1, // Invalid index
        });

        expect(response.status).toBe(400);
        expectErrorResponse(response, 'VALIDATION_ERROR');
      });

      it('should return 404 for non-existent device', async () => {
        const response = await apiHelper.createButton('non-existent-device', {
          index: 0,
          label: 'Test Button',
        });

        expect(response.status).toBe(404);
        expectErrorResponse(response, 'NOT_FOUND');
      });
    });

    describe('GET /api/devices/:deviceId/buttons/:buttonId', () => {
      it('should return 404 for non-existent device', async () => {
        const response = await apiHelper.getButton(
          'non-existent-device',
          'button-1'
        );

        expect(response.status).toBe(404);
        expectErrorResponse(response, 'NOT_FOUND');
      });
    });

    describe('DELETE /api/devices/:deviceId/buttons/:buttonId', () => {
      it('should return 404 for non-existent device', async () => {
        const response = await apiHelper.deleteButton(
          'non-existent-device',
          'button-1'
        );

        expect(response.status).toBe(404);
        expectErrorResponse(response, 'NOT_FOUND');
      });
    });

    describe('POST /api/devices/:deviceId/buttons/:buttonId/press', () => {
      it('should return 404 for non-existent device', async () => {
        const response = await apiHelper.pressButton(
          'non-existent-device',
          'button-1'
        );

        expect(response.status).toBe(404);
        expectErrorResponse(response, 'NOT_FOUND');
      });
    });
  });

  describe('Configuration API Integration', () => {
    describe('GET /api/config', () => {
      it('should return current configuration', async () => {
        const response = await apiHelper.getConfig();

        expect(response.status).toBe(200);
        expectSuccessResponse(response);
        expect(response.body.data).toMatchObject({
          server: expect.any(Object),
          n8n: expect.any(Object),
          streamdeck: expect.any(Object),
          database: expect.any(Object),
          logging: expect.any(Object),
        });
      });
    });

    describe('PUT /api/config', () => {
      it('should update configuration', async () => {
        const configUpdate = {
          logging: {
            level: 'debug',
          },
        };

        const response = await apiHelper.updateConfig(configUpdate);

        expect(response.status).toBe(200);
        expectSuccessResponse(response);
      });

      it('should return 400 for invalid configuration', async () => {
        const response = await apiHelper.updateConfig({
          server: {
            port: -1, // Invalid port
          },
        });

        expect(response.status).toBe(400);
        expectErrorResponse(response, 'VALIDATION_ERROR');
      });

      it('should return 400 for non-object data', async () => {
        const response = await request(app)
          .put('/api/config')
          .send('invalid-data');

        expect(response.status).toBe(400);
        expectErrorResponse(response, 'VALIDATION_ERROR');
      });
    });

    describe('GET /api/config/schema', () => {
      it('should return configuration schema', async () => {
        const response = await apiHelper.getConfigSchema();

        expect(response.status).toBe(200);
        expectSuccessResponse(response);
        expect(response.body.data).toMatchObject({
          type: 'object',
          properties: expect.any(Object),
        });
      });
    });

    describe('POST /api/config/validate', () => {
      it('should validate valid configuration', async () => {
        const validConfig = {
          server: {
            port: 3000,
            host: '0.0.0.0',
          },
        };

        const response = await apiHelper.validateConfig(validConfig);

        expect(response.status).toBe(200);
        expectSuccessResponse(response);
        expect(response.body.data.valid).toBe(true);
      });

      it('should return validation errors for invalid configuration', async () => {
        const invalidConfig = {
          server: {
            port: 70000, // Invalid port
          },
        };

        const response = await apiHelper.validateConfig(invalidConfig);

        expect(response.status).toBe(200);
        expectSuccessResponse(response);
        expect(response.body.data.valid).toBe(false);
        expect(response.body.data.errors).toBeInstanceOf(Array);
        expect(response.body.data.errors.length).toBeGreaterThan(0);
      });
    });

    describe('POST /api/config/reset', () => {
      it('should reset configuration to defaults', async () => {
        const response = await apiHelper.resetConfig();

        expect(response.status).toBe(200);
        expectSuccessResponse(response);
      });
    });

    describe('GET /api/config/health', () => {
      it('should return configuration health status', async () => {
        const response = await apiHelper.getConfigHealth();

        expect(response.status).toBe(200);
        expectSuccessResponse(response);
        expect(response.body.data).toMatchObject({
          overall: expect.stringMatching(/^(healthy|unhealthy)$/),
          server: expect.objectContaining({
            valid: expect.any(Boolean),
            errors: expect.any(Array),
          }),
          application: expect.objectContaining({
            valid: expect.any(Boolean),
            errors: expect.any(Array),
          }),
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: expect.stringContaining('not found'),
        }),
      });
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .put('/api/config')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should include request ID in all responses', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('requestId');
      expect(typeof response.body.requestId).toBe('string');
      expect(response.body.requestId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    });

    it('should include timestamp in all responses', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.timestamp).toBe('string');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/config')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'PUT');

      expect(response.status).toBe(204);
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health');

      expect(response.headers).toHaveProperty(
        'x-content-type-options',
        'nosniff'
      );
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty(
        'x-xss-protection',
        '1; mode=block'
      );
      expect(response.headers).toHaveProperty(
        'referrer-policy',
        'strict-origin-when-cross-origin'
      );
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON content type', async () => {
      const response = await request(app)
        .put('/api/config')
        .set('Content-Type', 'application/json')
        .send({ logging: { level: 'info' } });

      expect(response.status).toBe(200);
    });

    it('should return JSON responses', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
