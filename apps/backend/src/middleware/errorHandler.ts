import { Request, Response, NextFunction } from 'express';
import {
  ApiResponse,
  ApiError,
  ApiErrorCode,
  HttpStatusCode,
  createErrorResponse,
  Logger,
} from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import {
  AppError as CustomAppError,
  isAppError,
  ErrorSeverity,
  createErrorContext,
} from '../errors/CustomErrors';
import {
  logger as customLogger,
  LogCategory,
  logSecurityEvent,
} from '../services/logger';
import { performanceMonitor } from '../services/performanceMonitor';

const logger = new Logger({ level: config.logLevel }, 'ErrorHandler');

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;
  public details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = HttpStatusCode.INTERNAL_SERVER_ERROR,
    code: string = ApiErrorCode.INTERNAL_ERROR,
    details?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createAppError = (
  message: string,
  statusCode: number,
  code: string,
  details?: Record<string, any>
): AppError => {
  return new AppError(message, statusCode, code, details);
};

// Common error creators
export const createNotFoundError = (
  resource: string,
  id?: string
): AppError => {
  const message = id
    ? `${resource} with ID '${id}' not found`
    : `${resource} not found`;
  return new AppError(
    message,
    HttpStatusCode.NOT_FOUND,
    ApiErrorCode.NOT_FOUND
  );
};

export const createValidationError = (
  message: string,
  details?: Record<string, any>
): AppError => {
  return new AppError(
    message,
    HttpStatusCode.BAD_REQUEST,
    ApiErrorCode.VALIDATION_ERROR,
    details
  );
};

export const createUnauthorizedError = (
  message: string = 'Unauthorized'
): AppError => {
  return new AppError(
    message,
    HttpStatusCode.UNAUTHORIZED,
    ApiErrorCode.AUTHENTICATION_ERROR
  );
};

export const createForbiddenError = (
  message: string = 'Forbidden'
): AppError => {
  return new AppError(
    message,
    HttpStatusCode.FORBIDDEN,
    ApiErrorCode.AUTHORIZATION_ERROR
  );
};

export const createConflictError = (
  message: string,
  details?: Record<string, any>
): AppError => {
  return new AppError(
    message,
    HttpStatusCode.CONFLICT,
    ApiErrorCode.CONFLICT,
    details
  );
};

// Record error metrics
function recordErrorMetrics(error: CustomAppError, req: Request): void {
  try {
    performanceMonitor.recordMetric('errors.total', 1, 'count', {
      errorCode: error.code,
      severity: error.severity,
      statusCode: error.statusCode.toString(),
      endpoint: req.route?.path || req.path,
      method: req.method,
    });
  } catch (metricsError) {
    customLogger.warn('Failed to record error metrics', {
      error: metricsError,
    });
  }
}

// Enhanced error handling middleware
export const errorHandler = (
  error: Error | AppError | CustomAppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
  let apiError: ApiError;

  // Handle custom application errors first
  if (isAppError(error)) {
    statusCode = error.statusCode;
    apiError = {
      code: error.code,
      message: error.getUserMessage(),
      details: error.context,
    };

    // Log with custom logger
    customLogger.error(
      'Application error occurred',
      error,
      createErrorContext(req)
    );

    // Record metrics
    recordErrorMetrics(error, req);

    // Log security events for auth errors
    if (['UNAUTHORIZED', 'FORBIDDEN', 'TOKEN_EXPIRED'].includes(error.code)) {
      logSecurityEvent(
        'authentication_failure',
        error.severity === ErrorSeverity.HIGH ? 'high' : 'medium',
        'failure',
        {
          requestId: req.requestId,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
        }
      );
    }
  } else if (error instanceof AppError) {
    // Handle legacy AppError
    statusCode = error.statusCode;
    apiError = {
      code: error.code,
      message: error.message,
      details: error.details,
      ...(config.nodeEnv === 'development' && { stack: error.stack }),
    };
  } else if (error.name === 'ValidationError') {
    // Handle validation errors
    statusCode = HttpStatusCode.BAD_REQUEST;
    apiError = {
      code: ApiErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      details: { originalError: error.message },
      ...(config.nodeEnv === 'development' && { stack: error.stack }),
    };
  } else if (error.name === 'CastError') {
    // Handle database cast errors
    statusCode = HttpStatusCode.BAD_REQUEST;
    apiError = {
      code: ApiErrorCode.VALIDATION_ERROR,
      message: 'Invalid ID format',
      ...(config.nodeEnv === 'development' && { stack: error.stack }),
    };
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    // Handle MongoDB errors
    statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
    apiError = {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'Database error',
      ...(config.nodeEnv === 'development' && {
        details: { originalError: error.message },
        stack: error.stack,
      }),
    };
  } else {
    // Handle unexpected errors
    apiError = {
      code: ApiErrorCode.INTERNAL_ERROR,
      message:
        config.nodeEnv === 'production'
          ? 'Internal server error'
          : error.message,
      ...(config.nodeEnv === 'development' && { stack: error.stack }),
    };

    // Log unexpected errors with custom logger
    customLogger.error('Unexpected error occurred', error, {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      category: LogCategory.APPLICATION,
    });
  }

  // Log error with original logger for compatibility
  logger.error(`Error handling request ${req.method} ${req.url}`, error, {
    requestId: req.requestId,
    statusCode,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  // Send error response
  const errorResponse: ApiResponse = createErrorResponse(
    apiError,
    req.requestId
  );
  res.status(statusCode).json(errorResponse);
};

// Enhanced 404 handler for unmatched routes
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log potential security scanning attempts
  if (
    req.originalUrl.includes('..') ||
    req.originalUrl.includes('<script>') ||
    req.originalUrl.includes('admin') ||
    req.originalUrl.includes('wp-') ||
    req.originalUrl.includes('.php')
  ) {
    logSecurityEvent('potential_security_scan', 'medium', 'blocked', {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
    });
  }

  const error = createNotFoundError('Route', `${req.method} ${req.url}`);
  next(error);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Process handlers for uncaught exceptions and rejections
export function setupProcessHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    customLogger.error('Uncaught Exception - Application will exit', error, {
      category: LogCategory.APPLICATION,
      component: 'ProcessHandler',
    });

    // Perform graceful shutdown
    gracefulShutdown('uncaughtException', 1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    customLogger.error('Unhandled Promise Rejection', reason, {
      category: LogCategory.APPLICATION,
      component: 'ProcessHandler',
      metadata: { promise: promise.toString() },
    });

    // For now, just log - in production you might want to exit
    if (config.nodeEnv === 'production') {
      gracefulShutdown('unhandledRejection', 1);
    }
  });

  // Handle SIGTERM (graceful shutdown)
  process.on('SIGTERM', () => {
    customLogger.info('SIGTERM received - Starting graceful shutdown');
    gracefulShutdown('SIGTERM', 0);
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    customLogger.info('SIGINT received - Starting graceful shutdown');
    gracefulShutdown('SIGINT', 0);
  });
}

// Graceful shutdown handler
function gracefulShutdown(signal: string, exitCode: number): void {
  customLogger.info(`Graceful shutdown initiated by ${signal}`);

  // TODO: Implement graceful shutdown logic
  // - Close database connections
  // - Stop accepting new requests
  // - Finish processing current requests
  // - Close server
  // - Clean up resources

  setTimeout(() => {
    customLogger.info('Graceful shutdown completed');
    process.exit(exitCode);
  }, 5000); // Give 5 seconds for cleanup
}
