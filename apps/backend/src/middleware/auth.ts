import { Request, Response, NextFunction } from 'express';
import { AuthServiceDb } from '../services/authServiceDb';
import { UserRole } from '../types/auth';

export interface AuthenticatedRequest extends Request {
  user?: any;
  session?: any;
}

export class AuthMiddleware {
  constructor(private authService: AuthServiceDb) {}

  authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = this.extractToken(req);

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const { user, session } = await this.authService.validateToken(token);

      req.user = user;
      req.session = session;

      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }
  };

  requireRole = (requiredRole: UserRole) => {
    return (
      req: AuthenticatedRequest,
      res: Response,
      next: NextFunction
    ): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      if (req.user.role !== requiredRole && req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
        return;
      }

      next();
    };
  };

  requireAdmin = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    if (req.user.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED',
      });
      return;
    }

    next();
  };

  optional = async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = this.extractToken(req);

      if (token) {
        const { user, session } = await this.authService.validateToken(token);
        req.user = user;
        req.session = session;
      }

      next();
    } catch (error) {
      // Continue without authentication for optional routes
      next();
    }
  };

  checkSetup = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const setupRequired = await this.authService.isSetupRequired();

      if (setupRequired && !req.path.startsWith('/api/auth/setup')) {
        res.status(503).json({
          success: false,
          error: 'Initial setup required',
          code: 'SETUP_REQUIRED',
          setupUrl: '/api/auth/setup',
        });
        return;
      }

      if (!setupRequired && req.path.startsWith('/api/auth/setup')) {
        res.status(400).json({
          success: false,
          error: 'Setup has already been completed',
          code: 'SETUP_COMPLETED',
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Setup check failed',
        code: 'SETUP_CHECK_FAILED',
      });
    }
  };

  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookie
    const cookieToken = req.cookies?.accessToken;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }
}

// Rate limiting middleware
export const createRateLimiter = (
  windowMs: number,
  max: number,
  message?: string
) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [ip, data] of requests.entries()) {
      if (data.resetTime < windowStart) {
        requests.delete(ip);
      }
    }

    const current = requests.get(key);

    if (!current) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (current.resetTime < now) {
      // Reset window
      current.count = 1;
      current.resetTime = now + windowMs;
      next();
      return;
    }

    if (current.count >= max) {
      res.status(429).json({
        success: false,
        error: message || 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
      });
      return;
    }

    current.count++;
    next();
  };
};

// CSRF protection middleware
export const csrfProtection = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
      code: 'INVALID_CSRF_TOKEN',
    });
    return;
  }

  next();
};

// Generate CSRF token
export const generateCSRFToken = (): string => {
  return require('crypto').randomBytes(32).toString('hex');
};
