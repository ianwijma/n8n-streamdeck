import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserRepository, SessionRepository } from './repositories';
import { User as DbUser, Session as DbSession } from '../../generated/prisma';
import { logger, LogCategory } from './logger';

interface JWTPayload {
  userId: string;
  username: string;
  sessionId: string;
}

interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

interface LoginResponse {
  user: Omit<DbUser, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface SetupRequest {
  username: string;
  email?: string;
  password: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class AuthServiceDb {
  private userRepository: UserRepository;
  private sessionRepository: SessionRepository;

  private config = {
    jwtSecret:
      process.env.JWT_SECRET ||
      'your-super-secret-jwt-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '30'), // 30 minutes
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '60'), // 60 minutes
  };

  constructor() {
    this.userRepository = new UserRepository();
    this.sessionRepository = new SessionRepository();
  }

  async isSetupRequired(): Promise<boolean> {
    try {
      const users = await this.userRepository.findAll(false);
      return users.length === 0;
    } catch (error) {
      logger.error('Failed to check setup status', error as Error, {
        category: LogCategory.SECURITY,
      });
      return true;
    }
  }

  async setup(setupData: SetupRequest): Promise<LoginResponse> {
    const isSetupRequired = await this.isSetupRequired();
    if (!isSetupRequired) {
      throw new Error('Setup has already been completed');
    }

    // Validate password
    this.validatePassword(setupData.password);

    // Create admin user
    const passwordHash = await bcrypt.hash(
      setupData.password,
      this.config.bcryptRounds
    );

    const user = await this.userRepository.create({
      username: setupData.username,
      email: setupData.email,
      password: passwordHash,
    });

    logger.info('Setup completed successfully', {
      category: LogCategory.SECURITY,
      userId: user.id,
      metadata: { username: setupData.username },
    });

    // Auto-login after setup
    return this.createSession(user, '127.0.0.1', 'Setup', false);
  }

  async login(
    loginData: LoginRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResponse> {
    const { username, password, rememberMe = false } = loginData;

    // Find user
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      logger.warn('Login attempt with invalid username', {
        category: LogCategory.SECURITY,
        metadata: { username, ipAddress, userAgent },
      });
      throw new Error('Invalid credentials');
    }

    // Check if account is active
    if (!user.isActive) {
      logger.warn('Login attempt on inactive account', {
        category: LogCategory.SECURITY,
        userId: user.id,
        metadata: { username, ipAddress, userAgent },
      });
      throw new Error('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn('Login attempt with invalid password', {
        category: LogCategory.SECURITY,
        userId: user.id,
        metadata: { username, ipAddress, userAgent },
      });
      throw new Error('Invalid credentials');
    }

    logger.info('User logged in successfully', {
      category: LogCategory.SECURITY,
      userId: user.id,
      metadata: { username, ipAddress, userAgent, rememberMe },
    });

    return this.createSession(user, ipAddress, userAgent, rememberMe);
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    try {
      await this.sessionRepository.delete(sessionId);

      logger.info('User logged out successfully', {
        category: LogCategory.SECURITY,
        userId,
        metadata: { sessionId },
      });
    } catch (error) {
      logger.error('Failed to logout user', error as Error, {
        category: LogCategory.SECURITY,
        userId,
        metadata: { sessionId },
      });
      throw error;
    }
  }

  async validateToken(token: string): Promise<{
    user: Omit<DbUser, 'password'>;
    session: DbSession;
  }> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as JWTPayload;

      const user = await this.userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      const session = await this.sessionRepository.findByToken(token);
      if (!session || session.expiresAt < new Date()) {
        throw new Error('Session not found or expired');
      }

      const userWithoutPassword = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      return { user: userWithoutPassword, session };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async changePassword(
    userId: string,
    changeData: ChangePasswordRequest
  ): Promise<void> {
    const { currentPassword, newPassword } = changeData;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Hash new password
    const newPasswordHash = await bcrypt.hash(
      newPassword,
      this.config.bcryptRounds
    );

    await this.userRepository.update(userId, { password: newPasswordHash });

    // Revoke all existing sessions
    await this.sessionRepository.deleteByUserId(userId);

    logger.info('Password changed successfully', {
      category: LogCategory.SECURITY,
      userId,
    });
  }

  private async createSession(
    user: DbUser,
    ipAddress: string,
    userAgent: string,
    rememberMe: boolean = false
  ): Promise<LoginResponse> {
    const sessionId = crypto.randomUUID();
    const accessToken = this.generateAccessToken(user, sessionId);
    const refreshToken = crypto.randomBytes(64).toString('hex');

    const expiresAt = new Date(
      Date.now() + this.parseTimeToMs(this.config.jwtExpiresIn)
    );
    const sessionExpiresAt = rememberMe
      ? new Date(
          Date.now() + this.parseTimeToMs(this.config.refreshTokenExpiresIn)
        )
      : new Date(Date.now() + this.config.sessionTimeout * 60 * 1000);

    await this.sessionRepository.create({
      token: accessToken,
      refreshToken: refreshToken,
      userId: user.id,
      expiresAt: sessionExpiresAt,
      ipAddress,
      userAgent,
      isActive: true,
    });

    const userWithoutPassword = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
      expiresAt,
    };
  }

  private generateAccessToken(user: DbUser, sessionId: string): string {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      sessionId,
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  private validatePassword(password: string): void {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (errors.length > 0) {
      throw new Error(`Password validation failed: ${errors.join(', ')}`);
    }
  }

  private parseTimeToMs(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1));

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return parseInt(timeString) * 1000; // assume seconds if no unit
    }
  }

  async refreshToken(refreshData: { refreshToken: string }): Promise<{
    user: Omit<DbUser, 'password'>;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    try {
      // Find the session with the provided refresh token
      const session = await this.sessionRepository.findByRefreshToken(
        refreshData.refreshToken
      );

      if (!session) {
        throw new Error('Invalid refresh token');
      }

      // Check if the refresh token has expired
      if (session.expiresAt < new Date()) {
        // Clean up expired session
        await this.sessionRepository.delete(session.id);
        throw new Error('Refresh token has expired');
      }

      // Get the user associated with this session
      if (!session.userId) {
        // Clean up session without user
        await this.sessionRepository.delete(session.id);
        throw new Error('Session has no associated user');
      }

      const user = await this.userRepository.findById(session.userId);
      if (!user) {
        // Clean up orphaned session
        await this.sessionRepository.delete(session.id);
        throw new Error('User not found');
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user, session.id);

      const newRefreshToken = crypto.randomBytes(64).toString('hex');
      const newExpiresAt = new Date(
        Date.now() + this.parseTimeToMs(this.config.refreshTokenExpiresIn)
      );

      // Update the session with new refresh token and expiry
      await this.sessionRepository.update(session.id, {
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        lastActivity: new Date(),
      });

      logger.info('Token refreshed successfully', {
        category: LogCategory.SECURITY,
        userId: user.id,
        sessionId: session.id,
        metadata: { username: user.username },
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
      };
    } catch (error) {
      logger.error('Token refresh failed', error as Error, {
        category: LogCategory.SECURITY,
      });
      throw error;
    }
  }

  async getUserSessions(userId: string): Promise<DbSession[]> {
    return this.sessionRepository.findByUserId(userId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionRepository.delete(sessionId);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepository.deleteByUserId(userId);
  }

  // For testing purposes - reset setup state
  resetSetup(): void {
    // This would require clearing all users from the database
    // For now, just log a warning
    logger.warn(
      'Reset setup called - this should clear all users in production',
      {
        category: LogCategory.SECURITY,
      }
    );
  }

  // Admin methods - simplified implementations
  async getSecurityEvents(limit: number = 100): Promise<any[]> {
    // Return empty array for now - in full implementation, you'd have a security events table
    return [];
  }

  async getLoginAttempts(limit: number = 100): Promise<any[]> {
    // Return empty array for now - in full implementation, you'd have a login attempts table
    return [];
  }

  async getActiveSessions(): Promise<DbSession[]> {
    // Get all non-expired sessions
    const allSessions = await this.sessionRepository.findByUserId(''); // This needs to be fixed
    return allSessions.filter((session) => session.expiresAt > new Date());
  }

  // Cleanup expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await this.sessionRepository.deleteExpired();
      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired sessions`, {
          category: LogCategory.SECURITY,
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', error as Error, {
        category: LogCategory.SECURITY,
      });
    }
  }
}
