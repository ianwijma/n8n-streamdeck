import { Request, Response, NextFunction } from 'express';
import { 
  ApiResponse, 
  ApiError, 
  ApiErrorCode, 
  HttpStatusCode,
  createErrorResponse,
  Logger 
} from '@n8n-streamdeck/shared';
import { config } from '../config/environment';

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
export const createNotFoundError = (resource: string, id?: string): AppError => {
  const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
  return new AppError(message, HttpStatusCode.NOT_FOUND, ApiErrorCode.NOT_FOUND);
};

export const createValidationError = (message: string, details?: Record<string, any>): AppError => {
  return new AppError(message, HttpStatusCode.BAD_REQUEST, ApiErrorCode.VALIDATION_ERROR, details);
};

export const createUnauthorizedError = (message: string = 'Unauthorized'): AppError => {
  return new AppError(message, HttpStatusCode.UNAUTHORIZED, ApiErrorCode.AUTHENTICATION_ERROR);
};

export const createForbiddenError = (message: string = 'Forbidden'): AppError => {
  return new AppError(message, HttpStatusCode.FORBIDDEN, ApiErrorCode.AUTHORIZATION_ERROR);
};

export const createConflictError = (message: string, details?: Record<string, any>): AppError => {
  return new AppError(message, HttpStatusCode.CONFLICT, ApiErrorCode.CONFLICT, details);
};

// Error handling middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
  let apiError: ApiError;

  if (error instanceof AppError) {
    // Handle custom application errors
    statusCode = error.statusCode;
    apiError = {
      code: error.code,
      message: error.message,
      details: error.details,
      ...(config.nodeEnv === 'development' && { stack: error.stack }),
    };
  } else if (error.name === 'ValidationError') {
    // Handle validation errors (e.g., from Joi or similar)
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
        stack: error.stack 
      }),
    };
  } else {
    // Handle unexpected errors
    apiError = {
      code: ApiErrorCode.INTERNAL_ERROR,
      message: config.nodeEnv === 'production' 
        ? 'Internal server error' 
        : error.message,
      ...(config.nodeEnv === 'development' && { stack: error.stack }),
    };
  }

  // Log error
  logger.error(`Error handling request ${req.method} ${req.url}`, error, {
    requestId: req.requestId,
    statusCode,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  // Send error response
  const errorResponse: ApiResponse = createErrorResponse(apiError, req.requestId);
  res.status(statusCode).json(errorResponse);
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = createNotFoundError('Route', `${req.method} ${req.url}`);
  next(error);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};