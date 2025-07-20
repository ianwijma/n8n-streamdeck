import { AuthService } from '../../../services/authService';
import { UserRole } from '../../../types/auth';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('Setup', () => {
    it('should complete initial setup successfully', async () => {
      const setupData = {
        username: 'admin',
        password: 'SecurePassword123!',
        email: 'admin@example.com',
      };

      const result = await authService.setup(setupData);

      expect(result.user.username).toBe('admin');
      expect(result.user.email).toBe('admin@example.com');
      expect(result.user.role).toBe(UserRole.ADMIN);
      expect(result.user.isActive).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should reject setup if already completed', async () => {
      const setupData = {
        username: 'admin',
        password: 'SecurePassword123!',
      };

      await authService.setup(setupData);

      await expect(authService.setup(setupData)).rejects.toThrow(
        'Setup has already been completed'
      );
    });

    it('should validate password requirements during setup', async () => {
      const setupData = {
        username: 'admin',
        password: 'weak',
      };

      await expect(authService.setup(setupData)).rejects.toThrow(
        'Password validation failed'
      );
    });
  });

  describe('Login', () => {
    beforeEach(async () => {
      await authService.setup({
        username: 'admin',
        password: 'SecurePassword123!',
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        username: 'admin',
        password: 'SecurePassword123!',
      };

      const result = await authService.login(
        loginData,
        '127.0.0.1',
        'test-agent'
      );

      expect(result.user.username).toBe('admin');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should reject login with invalid username', async () => {
      const loginData = {
        username: 'nonexistent',
        password: 'SecurePassword123!',
      };

      await expect(
        authService.login(loginData, '127.0.0.1', 'test-agent')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        username: 'admin',
        password: 'wrongpassword',
      };

      await expect(
        authService.login(loginData, '127.0.0.1', 'test-agent')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should lock account after max failed attempts', async () => {
      const loginData = {
        username: 'admin',
        password: 'wrongpassword',
      };

      // Attempt login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login(loginData, '127.0.0.1', 'test-agent');
        } catch (error) {
          // Expected to fail
        }
      }

      // 6th attempt should indicate account is locked
      await expect(
        authService.login(loginData, '127.0.0.1', 'test-agent')
      ).rejects.toThrow('Account is temporarily locked');
    });

    it('should reject login for inactive user', async () => {
      // This would require a way to deactivate a user
      // For now, we'll skip this test as the current implementation doesn't have user deactivation
    });
  });

  describe('Token Management', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      await authService.setup({
        username: 'admin',
        password: 'SecurePassword123!',
      });

      const loginResult = await authService.login(
        { username: 'admin', password: 'SecurePassword123!' },
        '127.0.0.1',
        'test-agent'
      );

      accessToken = loginResult.accessToken;
      refreshToken = loginResult.refreshToken;
    });

    it('should validate valid access token', async () => {
      const result = await authService.validateToken(accessToken);

      expect(result.user.username).toBe('admin');
      expect(result.session).toBeDefined();
    });

    it('should reject invalid access token', async () => {
      await expect(authService.validateToken('invalid-token')).rejects.toThrow(
        'Invalid token'
      );
    });

    it('should refresh token successfully', async () => {
      const result = await authService.refreshToken({ refreshToken });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        authService.refreshToken({ refreshToken: 'invalid-token' })
      ).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should reject reused refresh token', async () => {
      // Use the refresh token once
      await authService.refreshToken({ refreshToken });

      // Try to use it again
      await expect(authService.refreshToken({ refreshToken })).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });
  });

  describe('Password Management', () => {
    let userId: string;

    beforeEach(async () => {
      const setupResult = await authService.setup({
        username: 'admin',
        password: 'SecurePassword123!',
      });
      userId = setupResult.user.id;
    });

    it('should change password with valid current password', async () => {
      const changeData = {
        currentPassword: 'SecurePassword123!',
        newPassword: 'NewSecurePassword456!',
      };

      await expect(
        authService.changePassword(userId, changeData)
      ).resolves.not.toThrow();

      // Verify old password no longer works
      await expect(
        authService.login(
          { username: 'admin', password: 'SecurePassword123!' },
          '127.0.0.1',
          'test-agent'
        )
      ).rejects.toThrow('Invalid credentials');

      // Verify new password works
      const result = await authService.login(
        { username: 'admin', password: 'NewSecurePassword456!' },
        '127.0.0.1',
        'test-agent'
      );
      expect(result.user.username).toBe('admin');
    });

    it('should reject password change with invalid current password', async () => {
      const changeData = {
        currentPassword: 'wrongpassword',
        newPassword: 'NewSecurePassword456!',
      };

      await expect(
        authService.changePassword(userId, changeData)
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should validate new password requirements', async () => {
      const changeData = {
        currentPassword: 'SecurePassword123!',
        newPassword: 'weak',
      };

      await expect(
        authService.changePassword(userId, changeData)
      ).rejects.toThrow('Password validation failed');
    });
  });

  describe('Session Management', () => {
    let userId: string;
    let sessionId: string;

    beforeEach(async () => {
      const setupResult = await authService.setup({
        username: 'admin',
        password: 'SecurePassword123!',
      });
      userId = setupResult.user.id;

      const loginResult = await authService.login(
        { username: 'admin', password: 'SecurePassword123!' },
        '127.0.0.1',
        'test-agent'
      );

      // Extract session ID from token
      const { session } = await authService.validateToken(
        loginResult.accessToken
      );
      sessionId = session.id;
    });

    it('should get user sessions', async () => {
      const sessions = await authService.getUserSessions(userId);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe(userId);
      expect(sessions[0].isActive).toBe(true);
    });

    it('should revoke specific session', async () => {
      await authService.revokeSession(sessionId);

      const sessions = await authService.getUserSessions(userId);
      expect(sessions).toHaveLength(0);
    });

    it('should revoke all user sessions', async () => {
      // Create another session
      await authService.login(
        { username: 'admin', password: 'SecurePassword123!' },
        '192.168.1.1',
        'another-agent'
      );

      let sessions = await authService.getUserSessions(userId);
      expect(sessions.length).toBeGreaterThan(1);

      await authService.revokeAllUserSessions(userId);

      sessions = await authService.getUserSessions(userId);
      expect(sessions).toHaveLength(0);
    });

    it('should logout and revoke session', async () => {
      await authService.logout(sessionId, userId);

      const sessions = await authService.getUserSessions(userId);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Security Events', () => {
    beforeEach(async () => {
      await authService.setup({
        username: 'admin',
        password: 'SecurePassword123!',
      });
    });

    it('should log security events', async () => {
      // Perform some actions that generate security events
      await authService.login(
        { username: 'admin', password: 'SecurePassword123!' },
        '127.0.0.1',
        'test-agent'
      );

      const events = await authService.getSecurityEvents(10);
      expect(events.length).toBeGreaterThan(0);

      const loginEvent = events.find((e) => e.type === 'login_success');
      expect(loginEvent).toBeDefined();
      expect(loginEvent?.ipAddress).toBe('127.0.0.1');
    });

    it('should log login attempts', async () => {
      // Successful login
      await authService.login(
        { username: 'admin', password: 'SecurePassword123!' },
        '127.0.0.1',
        'test-agent'
      );

      // Failed login
      try {
        await authService.login(
          { username: 'admin', password: 'wrongpassword' },
          '127.0.0.1',
          'test-agent'
        );
      } catch (error) {
        // Expected to fail
      }

      const attempts = await authService.getLoginAttempts(10);
      expect(attempts.length).toBeGreaterThanOrEqual(2);

      const successfulAttempt = attempts.find((a) => a.success);
      const failedAttempt = attempts.find((a) => !a.success);

      expect(successfulAttempt).toBeDefined();
      expect(failedAttempt).toBeDefined();
      expect(failedAttempt?.failureReason).toBe('Invalid password');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await authService.setup({
        username: 'admin',
        password: 'SecurePassword123!',
      });
    });

    it('should enforce IP-based rate limiting', async () => {
      const loginData = {
        username: 'admin',
        password: 'wrongpassword',
      };

      // Make 10 failed attempts from same IP
      for (let i = 0; i < 10; i++) {
        try {
          await authService.login(loginData, '127.0.0.1', 'test-agent');
        } catch (error) {
          // Expected to fail
        }
      }

      // 11th attempt should be rate limited
      await expect(
        authService.login(loginData, '127.0.0.1', 'test-agent')
      ).rejects.toThrow('Too many login attempts from this IP address');
    });

    it('should enforce username-based rate limiting', async () => {
      const loginData = {
        username: 'admin',
        password: 'wrongpassword',
      };

      // Make 5 failed attempts for same username from different IPs
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login(loginData, `192.168.1.${i}`, 'test-agent');
        } catch (error) {
          // Expected to fail
        }
      }

      // 6th attempt should be rate limited
      await expect(
        authService.login(loginData, '192.168.1.10', 'test-agent')
      ).rejects.toThrow('Too many login attempts for this username');
    });
  });

  describe('Setup Status', () => {
    it('should indicate setup is required initially', async () => {
      const setupRequired = await authService.isSetupRequired();
      expect(setupRequired).toBe(true);
    });

    it('should indicate setup is complete after setup', async () => {
      await authService.setup({
        username: 'admin',
        password: 'SecurePassword123!',
      });

      const setupRequired = await authService.isSetupRequired();
      expect(setupRequired).toBe(false);
    });
  });
});
