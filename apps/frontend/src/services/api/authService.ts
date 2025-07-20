import { apiClient } from '../../utils/apiClient';
import {
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  ChangePasswordRequest,
  SetupRequest,
  SetupResponse,
  User,
  Session,
  SecurityEvent,
  LoginAttempt,
} from '../../types/auth';

export class AuthService {
  private static instance: AuthService;
  private refreshPromise: Promise<void> | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async checkSetup(): Promise<{ setupRequired: boolean }> {
    return await apiClient.get<{ setupRequired: boolean }>(
      '/api/auth/setup/check'
    );
  }

  async setup(setupData: SetupRequest): Promise<SetupResponse> {
    return await apiClient.post<SetupResponse>('/api/auth/setup', setupData);
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return await apiClient.post<LoginResponse>('/api/auth/login', credentials);
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    }

    // Clear any stored tokens
    this.clearTokens();
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      await this.refreshPromise;
      return { expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
    }

    this.refreshPromise = this.performRefresh();

    try {
      await this.refreshPromise;
      return { expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<void> {
    await apiClient.post<RefreshTokenResponse>('/api/auth/refresh', {});
    // Tokens are handled via HTTP-only cookies, so no need to store them
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await apiClient.post('/api/auth/change-password', data);
  }

  async getProfile(): Promise<User> {
    const response = await apiClient.get<{ user: User }>('/api/auth/profile');
    return response.user;
  }

  async getSessions(): Promise<Session[]> {
    const response = await apiClient.get<{ sessions: Session[] }>(
      '/api/auth/sessions'
    );
    return response.sessions;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await apiClient.delete(`/api/auth/sessions/${sessionId}`);
  }

  async revokeAllSessions(): Promise<void> {
    await apiClient.delete('/api/auth/sessions');
  }

  // Admin methods
  async getSecurityEvents(limit?: number): Promise<SecurityEvent[]> {
    const params = limit ? { limit: limit.toString() } : {};
    const response = await apiClient.get<{ events: SecurityEvent[] }>(
      '/api/auth/admin/security-events',
      { params }
    );
    return response.events;
  }

  async getLoginAttempts(limit?: number): Promise<LoginAttempt[]> {
    const params = limit ? { limit: limit.toString() } : {};
    const response = await apiClient.get<{ attempts: LoginAttempt[] }>(
      '/api/auth/admin/login-attempts',
      { params }
    );
    return response.attempts;
  }

  async getActiveSessions(): Promise<Session[]> {
    const response = await apiClient.get<{ sessions: Session[] }>(
      '/api/auth/admin/active-sessions'
    );
    return response.sessions;
  }

  private clearTokens(): void {
    // Since we're using HTTP-only cookies, we can't clear them from JavaScript
    // The server will clear them when we call logout
    // But we can clear any localStorage/sessionStorage if we were using it
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
  }

  // Utility methods for password validation
  validatePassword(password: string): { isValid: boolean; errors: string[] } {
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

    const commonPasswords = [
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
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common, please choose a different one');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getPasswordStrength(password: string): {
    score: number;
    label: string;
    color: string;
  } {
    let score = 0;

    // Length
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;

    // Character types
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

    // Patterns
    if (!/(.)\1{2,}/.test(password)) score += 1; // No repeated characters
    if (!/123|abc|qwe/i.test(password)) score += 1; // No common sequences

    const labels = [
      'Very Weak',
      'Weak',
      'Fair',
      'Good',
      'Strong',
      'Very Strong',
    ];
    const colors = [
      '#ff4444',
      '#ff8800',
      '#ffaa00',
      '#88cc00',
      '#44aa00',
      '#00aa44',
    ];

    const index = Math.min(score, labels.length - 1);

    return {
      score,
      label: labels[index],
      color: colors[index],
    };
  }
}

export const authService = AuthService.getInstance();
