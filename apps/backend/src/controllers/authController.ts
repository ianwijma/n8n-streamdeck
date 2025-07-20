import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthServiceDb } from '../services/authServiceDb';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  LoginRequest,
  RefreshTokenRequest,
  ChangePasswordRequest,
  SetupRequest,
} from '../types/auth';

export class AuthController {
  constructor(private authService: AuthServiceDb) {}

  // Setup validation rules
  static setupValidation = [
    body('username')
      .isLength({ min: 3, max: 50 })
      .withMessage('Username must be between 3 and 50 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage(
        'Username can only contain letters, numbers, underscores, and hyphens'
      ),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('email')
      .optional({ values: 'falsy' })
      .isEmail()
      .withMessage('Invalid email format'),
  ];

  // Login validation rules
  static loginValidation = [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('rememberMe')
      .optional()
      .isBoolean()
      .withMessage('Remember me must be a boolean'),
  ];

  // Change password validation rules
  static changePasswordValidation = [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long'),
  ];

  // Refresh token validation rules
  static refreshTokenValidation = [];

  setup = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const setupData: SetupRequest = req.body;
      const result = await this.authService.setup(setupData);

      // Set secure HTTP-only cookie
      this.setAuthCookies(res, result.accessToken, result.refreshToken);

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          expiresAt: result.expiresAt,
        },
        message: 'Setup completed successfully',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Setup failed',
      });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      const loginData: LoginRequest = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const result = await this.authService.login(
        loginData,
        ipAddress,
        userAgent
      );

      // Set secure HTTP-only cookies
      this.setAuthCookies(
        res,
        result.accessToken,
        result.refreshToken,
        loginData.rememberMe
      );

      res.json({
        success: true,
        data: {
          user: result.user,
          expiresAt: result.expiresAt,
        },
        message: 'Login successful',
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      // Try to get refresh token from body or cookie
      const refreshTokenData: RefreshTokenRequest = {
        refreshToken: req.body.refreshToken || req.cookies.refreshToken,
      };

      if (!refreshTokenData.refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token is required',
        });
        return;
      }

      const result = await this.authService.refreshToken(refreshTokenData);

      // Set new cookies
      this.setAuthCookies(res, result.accessToken, result.refreshToken);

      res.json({
        success: true,
        data: {
          expiresAt: result.expiresAt,
        },
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      // Clear invalid cookies
      this.clearAuthCookies(res);

      res.status(401).json({
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      });
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.session && req.user) {
        await this.authService.logout(req.session.id, req.user.id);
      }

      // Clear cookies
      this.clearAuthCookies(res);

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      });
    }
  };

  changePassword = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const changeData: ChangePasswordRequest = req.body;
      await this.authService.changePassword(req.user.id, changeData);

      // Clear all cookies to force re-login
      this.clearAuthCookies(res);

      res.json({
        success: true,
        message: 'Password changed successfully. Please log in again.',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Password change failed',
      });
    }
  };

  getProfile = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get profile',
      });
    }
  };

  getSessions = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const sessions = await this.authService.getUserSessions(req.user.id);

      res.json({
        success: true,
        data: {
          sessions: sessions.map((session) => ({
            id: session.id,
            createdAt: session.createdAt,
            lastAccessedAt: session.lastAccessedAt,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            isActive: session.isActive,
            isCurrent: session.id === req.session?.id,
          })),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get sessions',
      });
    }
  };

  revokeSession = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { sessionId } = req.params;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'Session ID is required',
        });
        return;
      }

      await this.authService.revokeSession(sessionId);

      res.json({
        success: true,
        message: 'Session revoked successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to revoke session',
      });
    }
  };

  revokeAllSessions = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      await this.authService.revokeAllUserSessions(req.user.id);

      // Clear current session cookies
      this.clearAuthCookies(res);

      res.json({
        success: true,
        message: 'All sessions revoked successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to revoke sessions',
      });
    }
  };

  checkSetup = async (_req: Request, res: Response): Promise<void> => {
    try {
      const setupRequired = await this.authService.isSetupRequired();

      res.json({
        success: true,
        data: {
          setupRequired,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Setup check failed',
      });
    }
  };

  // For testing purposes - reset setup state
  resetSetup = async (_req: Request, res: Response): Promise<void> => {
    try {
      this.authService.resetSetup();
      res.json({
        success: true,
        message: 'Setup state reset successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Reset failed',
      });
    }
  };

  // Admin endpoints
  getSecurityEvents = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const events = await this.authService.getSecurityEvents(limit);

      res.json({
        success: true,
        data: {
          events,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get security events',
      });
    }
  };

  getLoginAttempts = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const attempts = await this.authService.getLoginAttempts(limit);

      res.json({
        success: true,
        data: {
          attempts,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get login attempts',
      });
    }
  };

  getActiveSessions = async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
        return;
      }

      const sessions = await this.authService.getActiveSessions();

      res.json({
        success: true,
        data: {
          sessions: sessions.map((session) => ({
            id: session.id,
            userId: session.userId,
            createdAt: session.createdAt,
            lastAccessedAt: session.lastAccessedAt,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            isActive: session.isActive,
          })),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get active sessions',
      });
    }
  };

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    rememberMe: boolean = false
  ): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const accessTokenMaxAge = 15 * 60 * 1000; // 15 minutes
    const refreshTokenMaxAge = rememberMe
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000; // 7 days or 1 day

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: accessTokenMaxAge,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: refreshTokenMaxAge,
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
  }
}
