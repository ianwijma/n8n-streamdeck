import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  User,
  RefreshToken,
  Session,
  JWTPayload,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ChangePasswordRequest,
  SetupRequest,
  UserRole,
  PasswordRequirements,
  LoginAttempt,
  SecurityEvent,
  SecurityEventType,
  AuthConfig,
} from '../types/auth';

export class AuthService {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private refreshTokens: Map<string, RefreshToken> = new Map();
  private loginAttempts: LoginAttempt[] = [];
  private securityEvents: SecurityEvent[] = [];
  private isSetupComplete = false;

  private config: AuthConfig = {
    jwtSecret:
      process.env.JWT_SECRET ||
      'your-super-secret-jwt-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '30'), // 30 minutes
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '60'), // 60 minutes
    requireStrongPassword: process.env.REQUIRE_STRONG_PASSWORD !== 'false',
    enableRememberMe: process.env.ENABLE_REMEMBER_ME !== 'false',
  };

  private passwordRequirements: PasswordRequirements = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    forbidCommonPasswords: true,
  };

  private commonPasswords = new Set([
    'password',
    '123456',
    '123456789',
    'qwerty',
    'abc123',
    'password123',
    'admin',
    'letmein',
    'welcome',
    'monkey',
    '1234567890',
    'password1',
  ]);

  constructor() {
    this.initializeDefaultUser();
  }

  private initializeDefaultUser(): void {
    // Check if setup is needed (no users exist)
    if (this.users.size === 0) {
      this.isSetupComplete = false;
    }
  }

  async setup(setupData: SetupRequest): Promise<LoginResponse> {
    if (this.isSetupComplete) {
      throw new Error('Setup has already been completed');
    }

    // Validate password
    this.validatePassword(setupData.password);

    // Create admin user
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(
      setupData.password,
      this.config.bcryptRounds
    );

    const user: User = {
      id: userId,
      username: setupData.username,
      email: setupData.email,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      failedLoginAttempts: 0,
      refreshTokens: [],
    };

    this.users.set(userId, user);
    this.isSetupComplete = true;

    // Log security event
    await this.logSecurityEvent({
      type: SecurityEventType.SETUP_COMPLETED,
      userId,
      ipAddress: '127.0.0.1',
      userAgent: 'Setup',
      details: { username: setupData.username },
    });

    // Auto-login after setup
    return this.createSession(user, '127.0.0.1', 'Setup', false);
  }

  async login(
    loginData: LoginRequest,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResponse> {
    const { username, password, rememberMe = false, deviceInfo } = loginData;

    // Check rate limiting
    await this.checkRateLimit(ipAddress, username);

    // Find user
    const user = Array.from(this.users.values()).find(
      (u) => u.username === username
    );

    if (!user) {
      await this.logLoginAttempt(
        ipAddress,
        username,
        false,
        userAgent,
        'User not found'
      );
      throw new Error('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.logLoginAttempt(
        ipAddress,
        username,
        false,
        userAgent,
        'Account locked'
      );
      throw new Error(
        'Account is temporarily locked due to too many failed attempts'
      );
    }

    // Check if account is active
    if (!user.isActive) {
      await this.logLoginAttempt(
        ipAddress,
        username,
        false,
        userAgent,
        'Account inactive'
      );
      throw new Error('Account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user, ipAddress, userAgent);
      throw new Error('Invalid credentials');
    }

    // Reset failed login attempts on successful login
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    user.updatedAt = new Date();

    await this.logLoginAttempt(ipAddress, username, true, userAgent);
    await this.logSecurityEvent({
      type: SecurityEventType.LOGIN_SUCCESS,
      userId: user.id,
      ipAddress,
      userAgent,
      details: { rememberMe, deviceInfo },
    });

    return this.createSession(
      user,
      ipAddress,
      userAgent,
      rememberMe,
      deviceInfo
    );
  }

  async refreshToken(
    refreshData: RefreshTokenRequest
  ): Promise<RefreshTokenResponse> {
    const { refreshToken } = refreshData;

    const storedRefreshToken = this.refreshTokens.get(refreshToken);

    if (
      !storedRefreshToken ||
      storedRefreshToken.isRevoked ||
      storedRefreshToken.expiresAt < new Date()
    ) {
      throw new Error('Invalid or expired refresh token');
    }

    const user = this.users.get(storedRefreshToken.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Revoke old refresh token
    storedRefreshToken.isRevoked = true;

    // Create new tokens
    const sessionId = crypto.randomUUID();
    const newAccessToken = this.generateAccessToken(user, sessionId);
    const newRefreshToken = this.generateRefreshToken(user.id);

    // Store new refresh token
    this.refreshTokens.set(newRefreshToken.token, newRefreshToken);
    user.refreshTokens.push(newRefreshToken);

    await this.logSecurityEvent({
      type: SecurityEventType.TOKEN_REFRESH,
      userId: user.id,
      ipAddress: '0.0.0.0', // IP not available in refresh context
      userAgent: 'Token Refresh',
      details: {
        oldTokenId: storedRefreshToken.id,
        newTokenId: newRefreshToken.id,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken.token,
      expiresAt: new Date(
        Date.now() + this.parseTimeToMs(this.config.jwtExpiresIn)
      ),
    };
  }

  async logout(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
    }

    // Revoke all refresh tokens for this user (optional - could be per-device)
    const user = this.users.get(userId);
    if (user) {
      user.refreshTokens.forEach((token) => {
        const storedToken = this.refreshTokens.get(token.token);
        if (storedToken) {
          storedToken.isRevoked = true;
        }
      });
    }

    await this.logSecurityEvent({
      type: SecurityEventType.LOGOUT,
      userId,
      ipAddress: session?.ipAddress || '0.0.0.0',
      userAgent: session?.userAgent || 'Unknown',
      details: { sessionId },
    });
  }

  async changePassword(
    userId: string,
    changeData: ChangePasswordRequest
  ): Promise<void> {
    const { currentPassword, newPassword } = changeData;

    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
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
    user.passwordHash = newPasswordHash;
    user.updatedAt = new Date();

    // Revoke all existing sessions and refresh tokens
    await this.revokeAllUserSessions(userId);

    await this.logSecurityEvent({
      type: SecurityEventType.PASSWORD_CHANGE,
      userId,
      ipAddress: '0.0.0.0',
      userAgent: 'Password Change',
      details: {},
    });
  }

  async validateToken(token: string): Promise<{
    user: Omit<User, 'passwordHash' | 'refreshTokens'>;
    session: Session;
  }> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as JWTPayload;

      const user = this.users.get(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      const session = this.sessions.get(decoded.sessionId);
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        throw new Error('Session not found or expired');
      }

      // Update last accessed time
      session.lastAccessedAt = new Date();

      const userWithoutSensitiveData = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil,
      };

      return { user: userWithoutSensitiveData, session };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async isSetupRequired(): Promise<boolean> {
    return !this.isSetupComplete;
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (session) => session.userId === userId && session.isActive
    );
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.delete(sessionId);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const userSessions = await this.getUserSessions(userId);
    for (const session of userSessions) {
      await this.revokeSession(session.id);
    }

    // Also revoke all refresh tokens
    const user = this.users.get(userId);
    if (user) {
      user.refreshTokens.forEach((token) => {
        const storedToken = this.refreshTokens.get(token.token);
        if (storedToken) {
          storedToken.isRevoked = true;
        }
      });
      user.refreshTokens = [];
    }
  }

  private async createSession(
    user: User,
    ipAddress: string,
    userAgent: string,
    rememberMe: boolean = false,
    deviceInfo?: string
  ): Promise<LoginResponse> {
    const sessionId = crypto.randomUUID();
    const accessToken = this.generateAccessToken(user, sessionId);
    const refreshToken = this.generateRefreshToken(user.id, deviceInfo);

    const expiresAt = new Date(
      Date.now() + this.parseTimeToMs(this.config.jwtExpiresIn)
    );
    const sessionExpiresAt = rememberMe
      ? new Date(
          Date.now() + this.parseTimeToMs(this.config.refreshTokenExpiresIn)
        )
      : new Date(Date.now() + this.config.sessionTimeout * 60 * 1000);

    const session: Session = {
      id: sessionId,
      userId: user.id,
      accessToken,
      refreshToken: refreshToken.token,
      expiresAt: sessionExpiresAt,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      ipAddress,
      userAgent,
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    this.refreshTokens.set(refreshToken.token, refreshToken);
    user.refreshTokens.push(refreshToken);

    const userWithoutSensitiveData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
    };

    return {
      user: userWithoutSensitiveData,
      accessToken,
      refreshToken: refreshToken.token,
      expiresAt,
    };
  }

  private generateAccessToken(user: User, sessionId: string): string {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      sessionId,
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  private generateRefreshToken(
    userId: string,
    deviceInfo?: string
  ): RefreshToken {
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(
      Date.now() + this.parseTimeToMs(this.config.refreshTokenExpiresIn)
    );

    return {
      id: crypto.randomUUID(),
      userId,
      token,
      expiresAt,
      createdAt: new Date(),
      isRevoked: false,
      deviceInfo,
    };
  }

  private validatePassword(password: string): void {
    if (!this.config.requireStrongPassword) {
      return;
    }

    const errors: string[] = [];

    if (password.length < this.passwordRequirements.minLength) {
      errors.push(
        `Password must be at least ${this.passwordRequirements.minLength} characters long`
      );
    }

    if (this.passwordRequirements.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.passwordRequirements.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.passwordRequirements.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (
      this.passwordRequirements.requireSpecialChars &&
      !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    if (
      this.passwordRequirements.forbidCommonPasswords &&
      this.commonPasswords.has(password.toLowerCase())
    ) {
      errors.push('Password is too common, please choose a different one');
    }

    if (errors.length > 0) {
      throw new Error(`Password validation failed: ${errors.join(', ')}`);
    }
  }

  private async handleFailedLogin(
    user: User,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    user.failedLoginAttempts += 1;
    user.updatedAt = new Date();

    if (user.failedLoginAttempts >= this.config.maxLoginAttempts) {
      user.lockedUntil = new Date(
        Date.now() + this.config.lockoutDuration * 60 * 1000
      );

      await this.logSecurityEvent({
        type: SecurityEventType.ACCOUNT_LOCKED,
        userId: user.id,
        ipAddress,
        userAgent,
        details: { failedAttempts: user.failedLoginAttempts },
      });
    }

    await this.logLoginAttempt(
      ipAddress,
      user.username,
      false,
      userAgent,
      'Invalid password'
    );
    await this.logSecurityEvent({
      type: SecurityEventType.LOGIN_FAILURE,
      userId: user.id,
      ipAddress,
      userAgent,
      details: { failedAttempts: user.failedLoginAttempts },
    });
  }

  private async checkRateLimit(
    ipAddress: string,
    username?: string
  ): Promise<void> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Check IP-based rate limiting
    const ipAttempts = this.loginAttempts.filter(
      (attempt) =>
        attempt.ipAddress === ipAddress &&
        attempt.timestamp > fiveMinutesAgo &&
        !attempt.success
    );

    if (ipAttempts.length >= 10) {
      throw new Error(
        'Too many login attempts from this IP address. Please try again later.'
      );
    }

    // Check username-based rate limiting
    if (username) {
      const usernameAttempts = this.loginAttempts.filter(
        (attempt) =>
          attempt.username === username &&
          attempt.timestamp > fiveMinutesAgo &&
          !attempt.success
      );

      if (usernameAttempts.length >= 5) {
        throw new Error(
          'Too many login attempts for this username. Please try again later.'
        );
      }
    }
  }

  private async logLoginAttempt(
    ipAddress: string,
    username: string,
    success: boolean,
    userAgent: string,
    failureReason?: string
  ): Promise<void> {
    const attempt: LoginAttempt = {
      id: crypto.randomUUID(),
      ipAddress,
      username,
      success,
      timestamp: new Date(),
      userAgent,
      failureReason,
    };

    this.loginAttempts.push(attempt);

    // Keep only last 1000 attempts
    if (this.loginAttempts.length > 1000) {
      this.loginAttempts = this.loginAttempts.slice(-1000);
    }
  }

  private async logSecurityEvent(
    event: Omit<SecurityEvent, 'id' | 'timestamp'>
  ): Promise<void> {
    const securityEvent: SecurityEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    this.securityEvents.push(securityEvent);

    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
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

  // Admin methods for monitoring
  async getSecurityEvents(limit: number = 100): Promise<SecurityEvent[]> {
    return this.securityEvents.slice(-limit).reverse();
  }

  async getLoginAttempts(limit: number = 100): Promise<LoginAttempt[]> {
    return this.loginAttempts.slice(-limit).reverse();
  }

  async getActiveSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (session) => session.isActive
    );
  }
}
