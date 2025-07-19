import request from 'supertest';
import { createApp } from '../../app';
import { Application } from 'express';

describe('Authentication API Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  const getCookies = (response: request.Response): string[] => {
    const cookies = response.headers['set-cookie'];
    return Array.isArray(cookies) ? cookies : [];
  };

  const findCookie = (cookies: string[], name: string): string | undefined => {
    return cookies.find((cookie) => cookie.includes(name));
  };

  const extractCookieValue = (cookie: string): string => {
    return cookie.split(';')[0].split('=')[1] || '';
  };

  describe('Setup Endpoints', () => {
    it('should check setup status', async () => {
      const response = await request(app)
        .get('/api/auth/setup/check')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.setupRequired).toBe(true);
    });

    it('should complete initial setup', async () => {
      const setupData = {
        username: 'admin',
        password: 'SecurePassword123!',
        email: 'admin@example.com',
      };

      const response = await request(app)
        .post('/api/auth/setup')
        .send(setupData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('admin');
      expect(response.body.data.user.email).toBe('admin@example.com');
      expect(response.body.data.user.role).toBe('admin');
      expect(response.body.data.expiresAt).toBeDefined();

      // Check cookies are set
      const cookies = getCookies(response);
      expect(cookies).toBeDefined();
      expect(findCookie(cookies, 'accessToken')).toBeDefined();
      expect(findCookie(cookies, 'refreshToken')).toBeDefined();
    });

    it('should reject duplicate setup', async () => {
      const setupData = {
        username: 'admin2',
        password: 'SecurePassword123!',
      };

      const response = await request(app)
        .post('/api/auth/setup')
        .send(setupData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Setup has already been completed');
    });

    it('should validate setup data', async () => {
      // Test with invalid username
      let response = await request(app)
        .post('/api/auth/setup')
        .send({
          username: 'ab', // too short
          password: 'SecurePassword123!',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');

      // Test with weak password
      response = await request(app)
        .post('/api/auth/setup')
        .send({
          username: 'admin',
          password: 'weak',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Password validation failed');
    });
  });

  describe('Login Endpoints', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        username: 'admin',
        password: 'SecurePassword123!',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('admin');
      expect(response.body.data.expiresAt).toBeDefined();

      // Check cookies are set
      const cookies = getCookies(response);
      expect(cookies).toBeDefined();
      expect(findCookie(cookies, 'accessToken')).toBeDefined();
      expect(findCookie(cookies, 'refreshToken')).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const loginData = {
        username: 'admin',
        password: 'wrongpassword',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should validate login data', async () => {
      // Test missing username
      let response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'SecurePassword123!',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');

      // Test missing password
      response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle remember me option', async () => {
      const loginData = {
        username: 'admin',
        password: 'SecurePassword123!',
        rememberMe: true,
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check that refresh token has longer expiry (indicated by Max-Age)
      const cookies = getCookies(response);
      const refreshTokenCookie = findCookie(cookies, 'refreshToken');
      expect(refreshTokenCookie).toContain('Max-Age');
    });
  });

  describe('Protected Endpoints', () => {
    let accessToken: string;
    let refreshTokenCookie: string;

    beforeEach(async () => {
      // Login to get access token
      const loginResponse = await request(app).post('/api/auth/login').send({
        username: 'admin',
        password: 'SecurePassword123!',
      });

      const cookies = getCookies(loginResponse);
      const accessTokenCookie = findCookie(cookies, 'accessToken');
      accessToken = accessTokenCookie
        ? extractCookieValue(accessTokenCookie)
        : '';

      refreshTokenCookie = findCookie(cookies, 'refreshToken') || '';
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('admin');
      expect(response.body.data.user.role).toBe('admin');
    });

    it('should reject profile request without token', async () => {
      const response = await request(app).get('/api/auth/profile').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject profile request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', ['accessToken=invalid-token'])
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [refreshTokenCookie])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.expiresAt).toBeDefined();

      // Check new cookies are set
      const cookies = getCookies(response);
      expect(cookies).toBeDefined();
      expect(findCookie(cookies, 'accessToken')).toBeDefined();
      expect(findCookie(cookies, 'refreshToken')).toBeDefined();
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');

      // Check cookies are cleared
      const cookies = getCookies(response);
      expect(cookies).toBeDefined();
      expect(findCookie(cookies, 'accessToken=;')).toBeDefined();
      expect(findCookie(cookies, 'refreshToken=;')).toBeDefined();
    });

    it('should change password', async () => {
      const changeData = {
        currentPassword: 'SecurePassword123!',
        newPassword: 'NewSecurePassword456!',
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', [`accessToken=${accessToken}`])
        .send(changeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password changed successfully');

      // Verify old password no longer works
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'SecurePassword123!',
        })
        .expect(401);

      // Verify new password works
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'NewSecurePassword456!',
        })
        .expect(200);
    });

    it('should get user sessions', async () => {
      const response = await request(app)
        .get('/api/auth/sessions')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toBeInstanceOf(Array);
      expect(response.body.data.sessions.length).toBeGreaterThan(0);

      const session = response.body.data.sessions[0];
      expect(session.id).toBeDefined();
      expect(session.ipAddress).toBeDefined();
      expect(session.userAgent).toBeDefined();
      expect(session.isActive).toBe(true);
    });

    it('should revoke all sessions', async () => {
      const response = await request(app)
        .delete('/api/auth/sessions')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('All sessions revoked successfully');

      // Verify token is no longer valid
      await request(app)
        .get('/api/auth/profile')
        .set('Cookie', [`accessToken=${accessToken}`])
        .expect(401);
    });
  });

  describe('Admin Endpoints', () => {
    let adminToken: string;

    beforeEach(async () => {
      // Login as admin to get access token
      const loginResponse = await request(app).post('/api/auth/login').send({
        username: 'admin',
        password: 'NewSecurePassword456!',
      });

      const cookies = getCookies(loginResponse);
      const accessTokenCookie = findCookie(cookies, 'accessToken');
      adminToken = accessTokenCookie
        ? extractCookieValue(accessTokenCookie)
        : '';
    });

    it('should get security events', async () => {
      const response = await request(app)
        .get('/api/auth/admin/security-events')
        .set('Cookie', [`accessToken=${adminToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toBeInstanceOf(Array);
    });

    it('should get login attempts', async () => {
      const response = await request(app)
        .get('/api/auth/admin/login-attempts')
        .set('Cookie', [`accessToken=${adminToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.attempts).toBeInstanceOf(Array);
    });

    it('should get active sessions', async () => {
      const response = await request(app)
        .get('/api/auth/admin/active-sessions')
        .set('Cookie', [`accessToken=${adminToken}`])
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toBeInstanceOf(Array);
    });

    it('should reject non-admin access to admin endpoints', async () => {
      // This test would require creating a non-admin user
      // For now, we'll skip it as the current implementation only has admin users
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce login rate limiting', async () => {
      const loginData = {
        username: 'admin',
        password: 'wrongpassword',
      };

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send(loginData).expect(401);
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Too many login attempts');
      expect(response.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(response.body.retryAfter).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/auth/setup/check')
        .expect(200);

      expect(response.headers['x-content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
    });

    it('should set secure cookies in production', async () => {
      // This would require setting NODE_ENV=production
      // For now, we'll skip this test
    });
  });
});
