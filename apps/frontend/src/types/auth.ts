export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  failedLoginAttempts: number;
  lockedUntil?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo?: string;
}

export interface LoginResponse {
  user: User;
  expiresAt: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  expiresAt: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SetupRequest {
  username: string;
  password: string;
  email?: string;
}

export interface SetupResponse {
  user: User;
  expiresAt: string;
}

export interface Session {
  id: string;
  createdAt: string;
  lastAccessedAt: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  isCurrent: boolean;
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface LoginAttempt {
  id: string;
  ipAddress: string;
  username?: string;
  success: boolean;
  timestamp: string;
  userAgent: string;
  failureReason?: string;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
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

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setupRequired: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  setup: (setupData: SetupRequest) => Promise<void>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
  refreshToken: () => Promise<void>;
  checkSetup: () => Promise<void>;
  clearError: () => void;
}

export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  forbidCommonPasswords: boolean;
}

export interface AuthError {
  message: string;
  code?: string;
  details?: any;
}
