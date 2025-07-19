/**
 * Custom Error Classes for N8N StreamDeck Application
 *
 * This module defines custom error classes for different scenarios
 * to provide better error handling and debugging capabilities.
 */

export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Device Related
  DEVICE_NOT_FOUND = 'DEVICE_NOT_FOUND',
  DEVICE_CONNECTION_FAILED = 'DEVICE_CONNECTION_FAILED',
  DEVICE_DISCONNECTED = 'DEVICE_DISCONNECTED',
  DEVICE_BUSY = 'DEVICE_BUSY',
  DEVICE_TIMEOUT = 'DEVICE_TIMEOUT',

  // Button Related
  BUTTON_NOT_FOUND = 'BUTTON_NOT_FOUND',
  BUTTON_CONFIGURATION_ERROR = 'BUTTON_CONFIGURATION_ERROR',
  BUTTON_PRESS_FAILED = 'BUTTON_PRESS_FAILED',

  // N8N Integration
  N8N_CONNECTION_ERROR = 'N8N_CONNECTION_ERROR',
  N8N_API_ERROR = 'N8N_API_ERROR',
  N8N_WORKFLOW_ERROR = 'N8N_WORKFLOW_ERROR',
  N8N_AUTHENTICATION_ERROR = 'N8N_AUTHENTICATION_ERROR',

  // System & Infrastructure
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Network & External Services
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // File & Resource Management
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  userId?: string;
  deviceId?: string;
  buttonId?: string;
  requestId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
}

/**
 * Base Application Error class
 */
export abstract class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly severity: ErrorSeverity;
  public readonly isOperational: boolean;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    isOperational: boolean = true,
    context: ErrorContext = {}
  ) {
    super(message);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.isOperational = isOperational;
    this.context = {
      ...context,
      timestamp: new Date(),
    };
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging and API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      severity: this.severity,
      isOperational: this.isOperational,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.message;
  }
}

/**
 * Authentication and Authorization Errors
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication failed',
    context: ErrorContext = {}
  ) {
    super(
      message,
      ErrorCode.UNAUTHORIZED,
      401,
      ErrorSeverity.MEDIUM,
      true,
      context
    );
  }
}

export class AuthorizationError extends AppError {
  constructor(
    message: string = 'Access forbidden',
    context: ErrorContext = {}
  ) {
    super(
      message,
      ErrorCode.FORBIDDEN,
      403,
      ErrorSeverity.MEDIUM,
      true,
      context
    );
  }
}

export class TokenExpiredError extends AppError {
  constructor(
    message: string = 'Token has expired',
    context: ErrorContext = {}
  ) {
    super(
      message,
      ErrorCode.TOKEN_EXPIRED,
      401,
      ErrorSeverity.LOW,
      true,
      context
    );
  }
}

/**
 * Validation Errors
 */
export class ValidationError extends AppError {
  public readonly fields: Record<string, string[]>;

  constructor(
    message: string = 'Validation failed',
    fields: Record<string, string[]> = {},
    context: ErrorContext = {}
  ) {
    super(
      message,
      ErrorCode.VALIDATION_ERROR,
      400,
      ErrorSeverity.LOW,
      true,
      context
    );
    this.fields = fields;
  }

  getUserMessage(): string {
    const fieldErrors = Object.entries(this.fields)
      .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
      .join('; ');

    return fieldErrors ? `Validation failed: ${fieldErrors}` : this.message;
  }
}

/**
 * Device Related Errors
 */
export class DeviceError extends AppError {
  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 400,
    context: ErrorContext = {}
  ) {
    super(message, code, statusCode, ErrorSeverity.MEDIUM, true, context);
  }
}

export class DeviceNotFoundError extends DeviceError {
  constructor(deviceId: string, context: ErrorContext = {}) {
    super(`Device not found: ${deviceId}`, ErrorCode.DEVICE_NOT_FOUND, 404, {
      ...context,
      deviceId,
    });
  }

  getUserMessage(): string {
    return 'The requested device could not be found. Please check if the device is connected.';
  }
}

export class DeviceConnectionError extends DeviceError {
  constructor(deviceId: string, reason?: string, context: ErrorContext = {}) {
    const message = reason
      ? `Failed to connect to device ${deviceId}: ${reason}`
      : `Failed to connect to device ${deviceId}`;

    super(message, ErrorCode.DEVICE_CONNECTION_FAILED, 503, {
      ...context,
      deviceId,
    });
  }

  getUserMessage(): string {
    return 'Unable to connect to the StreamDeck device. Please check the connection and try again.';
  }
}

export class DeviceTimeoutError extends DeviceError {
  constructor(deviceId: string, operation: string, context: ErrorContext = {}) {
    super(
      `Device operation timed out: ${operation} on ${deviceId}`,
      ErrorCode.DEVICE_TIMEOUT,
      408,
      { ...context, deviceId, additionalData: { operation } }
    );
  }

  getUserMessage(): string {
    return 'The device operation timed out. Please try again.';
  }
}

/**
 * Button Related Errors
 */
export class ButtonError extends AppError {
  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 400,
    context: ErrorContext = {}
  ) {
    super(message, code, statusCode, ErrorSeverity.LOW, true, context);
  }
}

export class ButtonNotFoundError extends ButtonError {
  constructor(buttonId: string, deviceId?: string, context: ErrorContext = {}) {
    super(
      `Button not found: ${buttonId}${deviceId ? ` on device ${deviceId}` : ''}`,
      ErrorCode.BUTTON_NOT_FOUND,
      404,
      { ...context, buttonId, deviceId }
    );
  }

  getUserMessage(): string {
    return 'The requested button could not be found.';
  }
}

/**
 * N8N Integration Errors
 */
export class N8NError extends AppError {
  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 502,
    context: ErrorContext = {}
  ) {
    super(message, code, statusCode, ErrorSeverity.HIGH, true, context);
  }
}

export class N8NConnectionError extends N8NError {
  constructor(
    message: string = 'Failed to connect to N8N',
    context: ErrorContext = {}
  ) {
    super(message, ErrorCode.N8N_CONNECTION_ERROR, 502, context);
  }

  getUserMessage(): string {
    return 'Unable to connect to N8N service. Please check your configuration.';
  }
}

export class N8NWorkflowError extends N8NError {
  public readonly workflowId?: string;

  constructor(workflowId: string, message: string, context: ErrorContext = {}) {
    super(
      `N8N workflow error (${workflowId}): ${message}`,
      ErrorCode.N8N_WORKFLOW_ERROR,
      502,
      { ...context, additionalData: { workflowId } }
    );
    this.workflowId = workflowId;
  }

  getUserMessage(): string {
    return 'There was an error executing the workflow. Please check your N8N configuration.';
  }
}

/**
 * System and Infrastructure Errors
 */
export class SystemError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    statusCode: number = 500,
    context: ErrorContext = {}
  ) {
    super(message, code, statusCode, ErrorSeverity.HIGH, false, context);
  }

  getUserMessage(): string {
    return 'An internal server error occurred. Please try again later.';
  }
}

export class DatabaseError extends SystemError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, ErrorCode.DATABASE_ERROR, 500, context);
  }

  getUserMessage(): string {
    return 'A database error occurred. Please try again later.';
  }
}

export class CacheError extends SystemError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, ErrorCode.CACHE_ERROR, 500, context);
  }

  getUserMessage(): string {
    return 'A caching error occurred. The operation may be slower than usual.';
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60, context: ErrorContext = {}) {
    super(
      `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      429,
      ErrorSeverity.LOW,
      true,
      context
    );
    this.retryAfter = retryAfter;
  }

  getUserMessage(): string {
    return `Too many requests. Please wait ${this.retryAfter} seconds before trying again.`;
  }
}

/**
 * Network and External Service Errors
 */
export class NetworkError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(
      message,
      ErrorCode.NETWORK_ERROR,
      503,
      ErrorSeverity.MEDIUM,
      true,
      context
    );
  }

  getUserMessage(): string {
    return 'A network error occurred. Please check your connection and try again.';
  }
}

export class TimeoutError extends AppError {
  public readonly timeoutMs: number;

  constructor(
    operation: string,
    timeoutMs: number,
    context: ErrorContext = {}
  ) {
    super(
      `Operation timed out: ${operation} (${timeoutMs}ms)`,
      ErrorCode.TIMEOUT_ERROR,
      408,
      ErrorSeverity.MEDIUM,
      true,
      { ...context, additionalData: { operation, timeoutMs } }
    );
    this.timeoutMs = timeoutMs;
  }

  getUserMessage(): string {
    return 'The operation timed out. Please try again.';
  }
}

/**
 * Resource Management Errors
 */
export class ResourceError extends AppError {
  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 507,
    context: ErrorContext = {}
  ) {
    super(message, code, statusCode, ErrorSeverity.HIGH, true, context);
  }
}

export class MemoryLimitError extends ResourceError {
  constructor(limit: number, current: number, context: ErrorContext = {}) {
    super(
      `Memory limit exceeded: ${current}MB / ${limit}MB`,
      ErrorCode.MEMORY_LIMIT_EXCEEDED,
      507,
      { ...context, additionalData: { limit, current } }
    );
  }

  getUserMessage(): string {
    return 'The system is running low on memory. Please try again later.';
  }
}

/**
 * Utility functions for error handling
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: any): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}

export function getErrorSeverity(error: any): ErrorSeverity {
  if (isAppError(error)) {
    return error.severity;
  }
  return ErrorSeverity.HIGH; // Unknown errors are treated as high severity
}

export function createErrorContext(req?: any): ErrorContext {
  if (!req) return {};

  return {
    requestId: req.requestId,
    userId: req.user?.id,
    sessionId: req.sessionID,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date(),
  };
}
