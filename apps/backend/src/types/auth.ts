export interface User {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  refreshTokens: RefreshToken[];
}

export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  isRevoked: boolean;
  deviceInfo?: string;
}

export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: UserRole;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo?: string;
}

export interface LoginResponse {
  user: Omit<User, 'passwordHash' | 'refreshTokens'>;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface SetupRequest {
  username: string;
  password: string;
  email?: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
  sessionTimeout: number; // in minutes
  requireStrongPassword: boolean;
  enableRememberMe: boolean;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  forbidCommonPasswords: boolean;
}

export interface LoginAttempt {
  id: string;
  ipAddress: string;
  username?: string;
  success: boolean;
  timestamp: Date;
  userAgent: string;
  failureReason?: string;
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  timestamp: Date;
}

export enum SecurityEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  TOKEN_REFRESH = 'token_refresh',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  SETUP_COMPLETED = 'setup_completed',
}

export interface AuthenticatedRequest extends Request {
  user: Omit<User, 'passwordHash' | 'refreshTokens'>;
  session: Session;
}
