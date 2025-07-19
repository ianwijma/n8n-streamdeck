import request from 'supertest';
import { Server } from 'http';
import { createApp } from '../../app';

describe('API Integration Tests', () => {
  let app: any;
  let server: Server;

  beforeAll(async () => {
    // Create app with test configuration
    app = createApp();
    server = app.listen(0); // Use random port
  });

  afterAll(async () => {
    server.close();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });
  });

  describe('Device Endpoints', () => {
    it('should get all devices', async () => {
      const response = await request(app).get('/api/devices').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should handle device not found', async () => {
      const response = await request(app)
        .get('/api/devices/non-existent-device')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle device connection request', async () => {
      const response = await request(app)
        .post('/api/devices/test-device/connect')
        .expect(404); // Device doesn't exist

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Button Endpoints', () => {
    it('should get buttons for device', async () => {
      const response = await request(app)
        .get('/api/devices/test-device/buttons')
        .expect(404); // Device doesn't exist

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle button creation', async () => {
      const buttonData = {
        index: 0,
        label: 'Test Button',
        action: {
          type: 'webhook',
          payload: { url: 'http://example.com/webhook' },
        },
      };

      const response = await request(app)
        .post('/api/devices/test-device/buttons')
        .send(buttonData)
        .expect(404); // Device doesn't exist

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Configuration Endpoints', () => {
    it('should get configuration', async () => {
      const response = await request(app).get('/api/config').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    it('should update configuration', async () => {
      const configData = {
        autoConnect: true,
        reconnectInterval: 5000,
      };

      const response = await request(app)
        .put('/api/config')
        .send(configData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/config')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/devices/test-device/buttons')
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle OPTIONS requests', async () => {
      const response = await request(app).options('/api/devices').expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });
  });

  describe('Request Validation', () => {
    it('should validate button creation data', async () => {
      const invalidButtonData = {
        index: 'invalid', // Should be number
        label: '', // Should not be empty
      };

      const response = await request(app)
        .post('/api/devices/test-device/buttons')
        .send(invalidButtonData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('validation');
    });

    it('should validate configuration updates', async () => {
      const invalidConfig = {
        autoConnect: 'invalid', // Should be boolean
        reconnectInterval: -1, // Should be positive
      };

      const response = await request(app)
        .put('/api/config')
        .send(invalidConfig)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Response Format', () => {
    it('should return consistent response format for success', async () => {
      const response = await request(app).get('/api/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return consistent error format', async () => {
      const response = await request(app)
        .get('/api/devices/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });
  });

  describe('Content-Type Handling', () => {
    it('should handle JSON content type', async () => {
      const response = await request(app)
        .post('/api/config')
        .set('Content-Type', 'application/json')
        .send({ autoConnect: true })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should reject non-JSON content for POST requests', async () => {
      const response = await request(app)
        .post('/api/config')
        .set('Content-Type', 'text/plain')
        .send('plain text')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
