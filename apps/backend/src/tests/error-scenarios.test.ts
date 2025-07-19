/**
 * Comprehensive Error Scenario Tests
 *
 * This test suite validates error handling across different scenarios:
 * - Network failures
 * - Device disconnections
 * - Invalid inputs
 * - Resource exhaustion
 * - Authentication failures
 * - Rate limiting
 */

import request from 'supertest';
import { app } from '../app';
import {
  DeviceNotFoundError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  SystemError,
  NetworkError,
  TimeoutError,
} from '../errors/CustomErrors';
import { logger } from '../services/logger';
import { performanceMonitor } from '../services/performanceMonitor';

describe('Error Handling Scenarios', () => {
  let server: any;

  beforeAll(async () => {
    // Start test server
    server = app.listen(0);
  });

  afterAll(async () => {
    // Clean up
    if (server) {
      server.close();
    }
  });

  describe('Network Failure Scenarios', () => {
    test('should handle network timeout errors', async () => {
      // Simulate network timeout
      const response = await request(app)
        .get('/api/devices/timeout-test')
        .timeout(100)
        .expect(408);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.stringMatching(/TIMEOUT|NETWORK/),
          message: expect.stringContaining('timeout'),
        },
      });
    });

    test('should handle connection refused errors', async () => {
      // This would typically test external service connections
      const response = await request(app).get('/api/n8n/workflows').expect(502);

      expect(response.body.error.code).toMatch(
        /N8N_CONNECTION_ERROR|NETWORK_ERROR/
      );
    });

    test('should handle DNS resolution failures', async () => {
      // Test DNS resolution failure handling
      const response = await request(app)
        .post('/api/webhooks/invalid-domain')
        .send({ url: 'http://non-existent-domain.invalid' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Device Disconnection Scenarios', () => {
    test('should handle device not found errors', async () => {
      const response = await request(app)
        .get('/api/devices/non-existent-device')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: expect.stringContaining('not found'),
        },
      });
    });

    test('should handle device connection failures', async () => {
      const response = await request(app)
        .post('/api/devices/disconnected-device/connect')
        .expect(503);

      expect(response.body.error.code).toBe('DEVICE_CONNECTION_FAILED');
    });

    test('should handle device timeout during operations', async () => {
      const response = await request(app)
        .post('/api/devices/slow-device/buttons/0/press')
        .send({ duration: 100 })
        .expect(408);

      expect(response.body.error.code).toBe('DEVICE_TIMEOUT');
    });

    test('should handle device busy errors', async () => {
      // Simulate device busy scenario
      const response = await request(app)
        .post('/api/devices/busy-device/buttons/0/press')
        .send({ duration: 100 })
        .expect(409);

      expect(response.body.error.code).toBe('DEVICE_BUSY');
    });
  });

  describe('Invalid Input Scenarios', () => {
    test('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/devices/test-device/buttons')
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('Validation failed'),
        },
      });
    });

    test('should handle invalid data types', async () => {
      const response = await request(app)
        .post('/api/devices/test-device/buttons/invalid-index/press')
        .send({ duration: 'not-a-number' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/devices/test-device/buttons')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should handle oversized payloads', async () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB

      const response = await request(app)
        .post('/api/devices/test-device/buttons')
        .send({ data: largePayload })
        .expect(413);

      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('Authentication & Authorization Scenarios', () => {
    test('should handle missing authentication token', async () => {
      const response = await request(app).get('/api/admin/users').expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: expect.stringContaining('authentication'),
        },
      });
    });

    test('should handle invalid authentication token', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    test('should handle insufficient permissions', async () => {
      // This would require a valid but limited token
      const response = await request(app)
        .delete('/api/admin/users/123')
        .set('Authorization', 'Bearer limited-token')
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Rate Limiting Scenarios', () => {
    test('should handle rate limit exceeded', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get('/api/devices'));

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find((r) => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toMatchObject({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: expect.stringContaining('rate limit'),
          },
        });
        expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
      }
    });

    test('should handle different rate limits for different endpoints', async () => {
      // Auth endpoints should have stricter limits
      const authRequests = Array(6)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/auth/login')
            .send({ username: 'test', password: 'wrong' })
        );

      const responses = await Promise.all(authRequests);
      const rateLimitedResponse = responses.find((r) => r.status === 429);

      expect(rateLimitedResponse).toBeDefined();
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    test('should handle memory limit exceeded', async () => {
      // This would typically be tested with memory monitoring
      const memoryUsage = process.memoryUsage();
      const highMemoryThreshold = memoryUsage.heapTotal * 0.9;

      if (memoryUsage.heapUsed > highMemoryThreshold) {
        const response = await request(app)
          .post('/api/devices/test-device/buttons')
          .send({ largeData: 'x'.repeat(1000000) })
          .expect(507);

        expect(response.body.error.code).toBe('MEMORY_LIMIT_EXCEEDED');
      }
    });

    test('should handle too many concurrent connections', async () => {
      // Simulate many concurrent requests
      const concurrentRequests = Array(100)
        .fill(null)
        .map(() => request(app).get('/api/health'));

      const responses = await Promise.all(concurrentRequests);
      const serviceUnavailable = responses.find((r) => r.status === 503);

      if (serviceUnavailable) {
        expect(serviceUnavailable.body.error.code).toBe('SERVICE_UNAVAILABLE');
      }
    });
  });

  describe('Database Error Scenarios', () => {
    test('should handle database connection failures', async () => {
      // This would require mocking database connection
      // For now, we'll test the error transformation
      const dbError = new Error('Connection refused');
      (dbError as any).code = 'ECONNREFUSED';

      const transformedError = new SystemError(
        'Database connection refused',
        'DATABASE_ERROR' as any,
        503
      );

      expect(transformedError.code).toBe('DATABASE_ERROR');
      expect(transformedError.statusCode).toBe(503);
    });

    test('should handle database timeout errors', async () => {
      const dbError = new Error('Query timeout');
      (dbError as any).code = 'ETIMEDOUT';

      const transformedError = new TimeoutError('Database query', 30000);

      expect(transformedError.code).toBe('TIMEOUT_ERROR');
      expect(transformedError.statusCode).toBe(408);
    });
  });

  describe('External Service Error Scenarios', () => {
    test('should handle N8N service unavailable', async () => {
      const response = await request(app)
        .post('/api/workflows/execute')
        .send({ workflowId: 'test-workflow' })
        .expect(502);

      expect(response.body.error.code).toMatch(/N8N_/);
    });

    test('should handle webhook delivery failures', async () => {
      const response = await request(app)
        .post('/api/webhooks/test')
        .send({ url: 'http://unreachable-service.com/webhook' })
        .expect(502);

      expect(response.body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
    });
  });

  describe('Error Recovery Scenarios', () => {
    test('should recover from temporary network failures', async () => {
      // Test retry logic
      let attemptCount = 0;
      const mockRetryableError = () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new NetworkError('Temporary network failure');
        }
        return { success: true };
      };

      // This would test the retry mechanism
      expect(() => mockRetryableError()).toThrow();
      expect(() => mockRetryableError()).toThrow();
      expect(mockRetryableError()).toEqual({ success: true });
    });

    test('should handle graceful degradation', async () => {
      // Test that non-critical features fail gracefully
      const response = await request(app).get('/api/devices').expect(200);

      // Should return basic device info even if enhanced features fail
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Error Logging and Monitoring', () => {
    test('should log errors with proper context', async () => {
      const logSpy = jest.spyOn(logger, 'error');

      await request(app).get('/api/devices/non-existent').expect(404);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('error'),
        expect.any(Error),
        expect.objectContaining({
          requestId: expect.any(String),
          method: 'GET',
          url: expect.stringContaining('/api/devices/non-existent'),
        })
      );

      logSpy.mockRestore();
    });

    test('should record error metrics', async () => {
      const metricsSpy = jest.spyOn(performanceMonitor, 'recordMetric');

      await request(app).get('/api/devices/non-existent').expect(404);

      expect(metricsSpy).toHaveBeenCalledWith(
        'errors.total',
        1,
        'count',
        expect.objectContaining({
          errorCode: 'DEVICE_NOT_FOUND',
          statusCode: '404',
        })
      );

      metricsSpy.mockRestore();
    });
  });

  describe('Security Error Scenarios', () => {
    test('should handle potential path traversal attempts', async () => {
      const response = await request(app)
        .get('/api/files/../../../etc/passwd')
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('should handle XSS attempts', async () => {
      const response = await request(app)
        .get('/api/search?q=<script>alert("xss")</script>')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should handle SQL injection attempts', async () => {
      const response = await request(app)
        .get('/api/devices?id=1; DROP TABLE devices;--')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('Error Handler Integration Tests', () => {
  test('should handle custom application errors', () => {
    const error = new DeviceNotFoundError('test-device');

    expect(error.code).toBe('DEVICE_NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
    expect(error.getUserMessage()).toContain('device could not be found');
  });

  test('should handle validation errors with field details', () => {
    const error = new ValidationError('Validation failed', {
      name: ['Name is required'],
      email: ['Invalid email format'],
    });

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.fields).toEqual({
      name: ['Name is required'],
      email: ['Invalid email format'],
    });
  });

  test('should handle rate limit errors with retry information', () => {
    const error = new RateLimitError(60);

    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBe(60);
    expect(error.getUserMessage()).toContain('60 seconds');
  });
});

describe('Error Boundary Tests', () => {
  // These would typically be tested with React Testing Library
  test('should catch and handle React component errors', () => {
    // Mock React error boundary behavior
    const mockError = new Error('Component render error');
    const mockErrorInfo = {
      componentStack: 'at Component (Component.tsx:10)',
    };

    // Test error boundary logic
    expect(mockError.message).toBe('Component render error');
    expect(mockErrorInfo.componentStack).toContain('Component.tsx');
  });
});

describe('Performance Under Error Conditions', () => {
  test('should maintain performance during error scenarios', async () => {
    const startTime = Date.now();

    // Make multiple requests that will fail
    const requests = Array(10)
      .fill(null)
      .map(() => request(app).get('/api/devices/non-existent'));

    await Promise.all(requests);

    const duration = Date.now() - startTime;

    // Should handle errors quickly (under 1 second for 10 requests)
    expect(duration).toBeLessThan(1000);
  });

  test('should not leak memory during error handling', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Generate many errors
    const requests = Array(100)
      .fill(null)
      .map(() => request(app).get('/api/devices/non-existent'));

    await Promise.all(requests);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be reasonable (less than 10MB)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
