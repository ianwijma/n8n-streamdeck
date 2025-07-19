import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';

const logger = new Logger({ level: config.logLevel }, 'RateLimiting');

// Store for tracking rate limits per IP and endpoint
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Custom rate limit store implementation
class CustomRateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  incr(
    key: string,
    cb: (err: any, result?: { totalHits: number; resetTime?: Date }) => void
  ): void {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      const resetTime = now + 15 * 60 * 1000; // 15 minutes
      this.store.set(key, { count: 1, resetTime });
      cb(null, { totalHits: 1, resetTime: new Date(resetTime) });
    } else {
      // Increment existing entry
      entry.count++;
      cb(null, {
        totalHits: entry.count,
        resetTime: new Date(entry.resetTime),
      });
    }
  }

  decrement(key: string): void {
    const entry = this.store.get(key);
    if (entry && entry.count > 0) {
      entry.count--;
    }
  }

  resetKey(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Rate limit store cleanup', { entriesRemoved: cleaned });
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

const customStore = new CustomRateLimitStore();

// General API rate limiter
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore as any,
  keyGenerator: (req: Request) => {
    // Use IP + User-Agent for better identification
    return `general:${req.ip}:${req.get('User-Agent') || 'unknown'}`;
  },
});

// Strict rate limiter for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore as any,
  keyGenerator: (req: Request) => {
    return `auth:${req.ip}`;
  },
});

// Device operation rate limiter
export const deviceRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 device operations per minute
  message: {
    error: 'Too many device operations, please slow down.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore as any,
  keyGenerator: (req: Request) => {
    return `device:${req.ip}`;
  },
});

// Button operation rate limiter (more restrictive)
export const buttonRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // Limit each IP to 200 button operations per minute
  message: {
    error: 'Too many button operations, please slow down.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore as any,
  keyGenerator: (req: Request) => {
    return `button:${req.ip}`;
  },
});

// Health check rate limiter (very permissive)
export const healthRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 health checks per minute
  message: {
    error: 'Too many health check requests.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: customStore as any,
  keyGenerator: (req: Request) => {
    return `health:${req.ip}`;
  },
});

// Adaptive rate limiter that adjusts based on system load
export class AdaptiveRateLimit {
  private baseLimit: number;
  private currentLimit: number;
  private systemLoadThreshold: number = 0.8;
  private checkInterval: NodeJS.Timeout;

  constructor(baseLimit: number = 1000) {
    this.baseLimit = baseLimit;
    this.currentLimit = baseLimit;

    // Check system load every 30 seconds
    this.checkInterval = setInterval(() => {
      this.adjustLimits();
    }, 30 * 1000);
  }

  private adjustLimits(): void {
    // Simple CPU usage check (in a real implementation, you'd use more sophisticated metrics)
    const memUsage = process.memoryUsage();
    const memUsagePercent = memUsage.heapUsed / memUsage.heapTotal;

    if (memUsagePercent > this.systemLoadThreshold) {
      // Reduce limits when system is under load
      this.currentLimit = Math.max(this.baseLimit * 0.5, 100);
      logger.warn(
        'Adaptive rate limiting: reducing limits due to high system load',
        {
          memUsagePercent,
          newLimit: this.currentLimit,
        }
      );
    } else {
      // Restore normal limits
      this.currentLimit = this.baseLimit;
    }
  }

  getMiddleware() {
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      max: () => this.currentLimit,
      message: {
        error: 'System is under high load, please try again later.',
        retryAfter: '15 minutes',
      },
      store: customStore as any,
    });
  }

  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Create adaptive rate limiter instance
export const adaptiveRateLimit = new AdaptiveRateLimit();

// Rate limiting middleware with custom logic
export const customRateLimit = (options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return (req: Request, res: Response, next: Function) => {
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : `custom:${req.ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      rateLimitStore.set(key, { count: 1, resetTime: now + options.windowMs });
      next();
    } else if (entry.count < options.max) {
      // Increment and allow
      entry.count++;
      next();
    } else {
      // Rate limit exceeded
      logger.warn('Custom rate limit exceeded', {
        key,
        ip: req.ip,
        path: req.path,
      });

      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
    }
  };
};

// Cleanup function for graceful shutdown
export const shutdownRateLimiting = (): void => {
  customStore.shutdown();
  adaptiveRateLimit.shutdown();
  rateLimitStore.clear();
  logger.info('Rate limiting shutdown completed');
};

// Export store for testing
export { customStore };
