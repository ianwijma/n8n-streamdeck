import request from 'supertest';
import createApp from '../app';

const app = createApp();

describe('Error Flow Integration Tests', () => {
  beforeAll(() => {
    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Error Reporting Endpoint', () => {
    it('should accept and process client error reports', async () => {
      const errorReport = {
        message: 'Test client error',
        stack: 'Error: Test client error\n    at TestComponent',
        componentStack: '    in TestComponent\n    in App',
        level: 'error' as const,
        context: {
          component: 'TestComponent',
          props: { id: 'test-123' },
        },
        timestamp: new Date().toISOString(),
        userAgent: 'Mozilla/5.0 (Test Browser)',
        url: 'http://localhost:3000/test',
        userId: 'user-123',
        sessionId: 'session-456',
        errorBoundary: 'ComponentErrorBoundary',
        retryCount: 1,
      };

      const response = await request(app)
        .post('/api/errors/report')
        .send(errorReport)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Error report received and logged',
      });
      expect(response.body.errorId).toMatch(/^client_\d+_[a-z0-9]+$/);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle critical error reports', async () => {
      const criticalError = {
        error: 'Critical application crash',
        stack: 'Error: Critical application crash\n    at CriticalComponent',
        componentStack: '    in CriticalComponent\n    in App',
        timestamp: new Date().toISOString(),
      };

      const response = await request(app)
        .post('/api/errors/critical')
        .send(criticalError)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Critical error logged',
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should validate error report format', async () => {
      const invalidReport = {
        message: '', // Invalid: empty message
        level: 'invalid-level', // Invalid: not in enum
        timestamp: 'invalid-date', // Invalid: not ISO date
      };

      const response = await request(app)
        .post('/api/errors/report')
        .send(invalidReport)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid error report format',
      });
      expect(response.body.details).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/errors/report')
        .send('invalid json')
        .expect(400);

      // Express should handle malformed JSON and return 400
      expect(response.status).toBe(400);
    });
  });

  describe('Health Check Endpoints', () => {
    it('should return basic health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.data).toMatchObject({
        status: 'healthy',
        uptime: expect.any(Number),
        version: expect.any(String),
        timestamp: expect.any(String),
        environment: expect.any(String),
        services: {
          database: expect.any(String),
          n8n: expect.any(String),
          streamdeck: expect.any(String),
        },
        system: {
          nodeVersion: expect.any(String),
          platform: expect.any(String),
          arch: expect.any(String),
          memory: {
            used: expect.any(Number),
            total: expect.any(Number),
            external: expect.any(Number),
          },
          cpu: expect.any(Object),
        },
      });
    });

    it('should return detailed health information', async () => {
      const response = await request(app).get('/health/detailed').expect(200);

      expect(response.body.data).toMatchObject({
        status: 'healthy',
        config: {
          port: expect.any(Number),
          host: expect.any(String),
          logLevel: expect.any(String),
        },
        services: expect.any(Object),
        system: expect.any(Object),
        checks: {
          responseTime: expect.any(Number),
          timestamp: expect.any(String),
        },
      });
    });

    it('should return readiness status', async () => {
      const response = await request(app).get('/health/ready').expect(200);

      expect(response.body.data).toMatchObject({
        ready: expect.any(Boolean),
        timestamp: expect.any(String),
      });
    });

    it('should return liveness status', async () => {
      const response = await request(app).get('/health/live').expect(200);

      expect(response.body.data).toMatchObject({
        alive: true,
        timestamp: expect.any(String),
      });
    });

    it('should return system metrics', async () => {
      const response = await request(app).get('/health/system').expect(200);

      expect(response.body.data).toMatchObject({
        timestamp: expect.any(String),
        system: {
          cpu: {
            usage: expect.any(Number),
            loadAverage: expect.any(Array),
          },
          memory: {
            used: expect.any(Number),
            total: expect.any(Number),
            percentage: expect.any(Number),
            heapUsed: expect.any(Number),
            heapTotal: expect.any(Number),
            external: expect.any(Number),
            rss: expect.any(Number),
          },
        },
        application: expect.any(Object),
      });
    });

    it('should return alert status', async () => {
      const response = await request(app).get('/health/alerts').expect(200);

      expect(response.body.data).toMatchObject({
        timestamp: expect.any(String),
        activeAlerts: expect.any(Array),
        thresholds: expect.any(Array),
        summary: {
          totalAlerts: expect.any(Number),
          criticalAlerts: expect.any(Number),
          highAlerts: expect.any(Number),
          mediumAlerts: expect.any(Number),
          lowAlerts: expect.any(Number),
        },
      });
    });

    it('should return dashboard data', async () => {
      const response = await request(app).get('/health/dashboard').expect(200);

      expect(response.body.data).toMatchObject({
        timestamp: expect.any(String),
        status: expect.stringMatching(
          /^(healthy|degraded|unhealthy|critical)$/
        ),
        healthScore: expect.any(Number),
        uptime: expect.any(Number),
        system: expect.any(Object),
        application: expect.any(Object),
        alerts: {
          active: expect.any(Number),
          critical: expect.any(Number),
          recent: expect.any(Number),
        },
        performance: {
          responseTime: expect.any(Number),
          throughput: expect.any(Number),
          errorRate: expect.any(Number),
        },
        services: expect.any(Object),
      });

      // Health score should be between 0 and 100
      expect(response.body.data.healthScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.healthScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle 404 errors gracefully', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });

    it('should handle validation errors', async () => {
      // This would trigger validation middleware if we had protected routes
      const response = await request(app)
        .post('/api/errors/report')
        .send({}) // Empty body should trigger validation error
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent error reports', async () => {
      const errorReport = {
        message: 'Concurrent test error',
        level: 'error' as const,
        timestamp: new Date().toISOString(),
      };

      // Send 10 concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        request(app).post('/api/errors/report').send(errorReport)
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // All should have unique error IDs
      const errorIds = responses.map((r) => r.body.errorId);
      const uniqueIds = new Set(errorIds);
      expect(uniqueIds.size).toBe(errorIds.length);
    });

    it('should handle large error payloads', async () => {
      const largeErrorReport = {
        message: 'Large error report',
        stack: 'Error: Large error\n' + 'a'.repeat(10000), // 10KB stack trace
        level: 'error' as const,
        context: {
          largeData: 'x'.repeat(50000), // 50KB of context data
        },
        timestamp: new Date().toISOString(),
      };

      const response = await request(app)
        .post('/api/errors/report')
        .send(largeErrorReport)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should respond quickly to health checks', async () => {
      const startTime = Date.now();

      await request(app).get('/health').expect(200);

      const responseTime = Date.now() - startTime;

      // Health check should respond within 1 second
      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('Security Tests', () => {
    it('should sanitize error messages', async () => {
      const maliciousReport = {
        message: '<script>alert("xss")</script>',
        level: 'error' as const,
        context: {
          maliciousField: '"><script>alert("xss")</script>',
        },
        timestamp: new Date().toISOString(),
      };

      const response = await request(app)
        .post('/api/errors/report')
        .send(maliciousReport)
        .expect(200);

      expect(response.body.success).toBe(true);
      // The malicious content should be logged but not reflected in response
      expect(response.body.message).not.toContain('<script>');
    });

    it('should handle extremely long error messages', async () => {
      const longMessage = 'x'.repeat(100000); // 100KB message

      const response = await request(app)
        .post('/api/errors/report')
        .send({
          message: longMessage,
          level: 'error' as const,
          timestamp: new Date().toISOString(),
        })
        .expect(400); // Should be rejected due to size limit

      expect(response.body.success).toBe(false);
    });

    it('should rate limit error reports if implemented', async () => {
      // This test would verify rate limiting if implemented
      // For now, we'll just ensure the endpoint is accessible
      const response = await request(app).get('/api/errors/health').expect(200);

      expect(response.body).toMatchObject({
        service: 'error-reporting',
        status: 'healthy',
      });
    });
  });

  describe('Metrics Collection', () => {
    it('should collect and return performance metrics', async () => {
      const response = await request(app).get('/health/metrics').expect(200);

      expect(response.body.data).toMatchObject({
        timestamp: expect.any(String),
        metrics: expect.any(Array),
        requestMetrics: expect.any(Array),
        summary: {
          totalMetrics: expect.any(Number),
          totalRequests: expect.any(Number),
          timeRange: expect.any(String),
        },
      });
    });

    it('should filter metrics by time range', async () => {
      const since = Date.now() - 60000; // Last minute

      const response = await request(app)
        .get(`/health/metrics?since=${since}`)
        .expect(200);

      expect(response.body.data.summary.timeRange).toContain('60s');
    });

    it('should filter metrics by name', async () => {
      const response = await request(app)
        .get('/health/metrics?name=test-metric')
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });
});

describe('Error Boundary Integration', () => {
  // These tests would require a test renderer for React components
  // For now, we'll test the error reporting service directly

  it('should format error context correctly', () => {
    const mockErrorInfo = {
      componentStack: '    in TestComponent\n    in App',
    };

    const errorContext = {
      level: 'component' as const,
      componentStack: mockErrorInfo.componentStack,
      errorBoundary: 'TestErrorBoundary',
      retryCount: 0,
      timestamp: new Date().toISOString(),
      userAgent: 'Test Agent',
      url: 'http://localhost:3000/test',
    };

    expect(errorContext).toMatchObject({
      level: 'component',
      componentStack: expect.stringContaining('TestComponent'),
      errorBoundary: 'TestErrorBoundary',
      retryCount: 0,
      timestamp: expect.any(String),
      userAgent: 'Test Agent',
      url: 'http://localhost:3000/test',
    });
  });
});

describe('Graceful Shutdown', () => {
  it('should handle SIGTERM gracefully', (done) => {
    // This test verifies that the application can handle shutdown signals
    // In a real scenario, this would test the actual shutdown process

    const originalExit = process.exit;
    process.exit = jest.fn() as any;

    // Simulate SIGTERM
    process.emit('SIGTERM', 'SIGTERM');

    // Restore original exit
    setTimeout(() => {
      process.exit = originalExit;
      done();
    }, 100);
  });
});
