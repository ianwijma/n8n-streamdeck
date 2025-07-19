/**
 * Structured Logging Service
 *
 * This module provides comprehensive logging capabilities with:
 * - Structured JSON logging
 * - Multiple log levels
 * - Log rotation and cleanup
 * - Performance and security logging
 * - Error tracking and correlation
 */

import path from 'path';
import fs from 'fs';
import { config } from '../config/environment';
import { AppError, isAppError } from '../errors/CustomErrors';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug',
}

export enum LogCategory {
  APPLICATION = 'application',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  AUDIT = 'audit',
  DEVICE = 'device',
  N8N = 'n8n',
  API = 'api',
  DATABASE = 'database',
  CACHE = 'cache',
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  buttonId?: string;
  workflowId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  category?: LogCategory;
  component?: string;
  operation?: string;
  duration?: number;
  key?: string;
  hit?: boolean;
  error?: any;
  metadata?: Record<string, any>;
}

export interface SecurityLogContext extends LogContext {
  category: LogCategory.SECURITY;
  securityEvent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source?: string;
  target?: string;
  outcome: 'success' | 'failure' | 'blocked';
}

export interface PerformanceLogContext extends LogContext {
  category: LogCategory.PERFORMANCE;
  operation: string;
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  cacheHitRate?: number;
  throughput?: number;
}

export interface AuditLogContext extends LogContext {
  category: LogCategory.AUDIT;
  action: string;
  resource: string;
  outcome: 'success' | 'failure';
  changes?: Record<string, any>;
  previousValues?: Record<string, any>;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  version: string;
  environment: string;
  pid: number;
  hostname: string;
  [key: string]: any;
}

class LoggerService {
  private static instance: LoggerService;
  private logDir: string;
  private logLevel: LogLevel;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logLevel = LogLevel.INFO; // Default to INFO level
    this.ensureLogDirectory();
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.ERROR,
      LogLevel.WARN,
      LogLevel.INFO,
      LogLevel.HTTP,
      LogLevel.DEBUG,
    ];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    context: LogContext = {}
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      service: 'n8n-streamdeck-backend',
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      pid: process.pid,
      hostname: require('os').hostname(),
      ...context,
    };
  }

  private writeToFile(filename: string, logEntry: LogEntry): void {
    const logPath = path.join(this.logDir, filename);
    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      fs.appendFileSync(logPath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private writeToConsole(logEntry: LogEntry): void {
    const {
      timestamp,
      level,
      message,
      category,
      component,
      requestId,
      ...meta
    } = logEntry;

    let prefix = `${timestamp} [${level}]`;
    if (category) prefix += ` [${category.toUpperCase()}]`;
    if (component) prefix += ` [${component}]`;
    if (requestId) prefix += ` [${requestId}]`;

    const metaStr =
      Object.keys(meta).length > 5 ? '' : ` ${JSON.stringify(meta)}`;
    const logMessage = `${prefix} ${message}${metaStr}`;

    // Use appropriate console method based on level
    switch (level.toLowerCase()) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'debug':
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context: LogContext = {}
  ): void {
    if (!this.shouldLog(level)) return;

    const logEntry = this.formatLogEntry(level, message, context);

    // Write to console in development
    if (config.nodeEnv === 'development') {
      this.writeToConsole(logEntry);
    }

    // Write to files
    const today = new Date().toISOString().split('T')[0];

    // Combined log
    this.writeToFile(`combined-${today}.log`, logEntry);

    // Category-specific logs
    if (context.category) {
      this.writeToFile(`${context.category}-${today}.log`, logEntry);
    }

    // Error-specific log
    if (level === LogLevel.ERROR) {
      this.writeToFile(`error-${today}.log`, logEntry);
    }
  }

  // Basic logging methods
  error(
    message: string,
    error?: Error | AppError,
    context: LogContext = {}
  ): void {
    const logData: LogContext = {
      ...context,
      category: context.category || LogCategory.APPLICATION,
    };

    if (error) {
      if (isAppError(error)) {
        logData.error = {
          name: error.name,
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          severity: error.severity,
          isOperational: error.isOperational,
          context: error.context,
          stack: error.stack,
        };
      } else {
        logData.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      }
    }

    this.log(LogLevel.ERROR, message, logData);
  }

  warn(message: string, context: LogContext = {}): void {
    this.log(LogLevel.WARN, message, {
      ...context,
      category: context.category || LogCategory.APPLICATION,
    });
  }

  info(message: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, {
      ...context,
      category: context.category || LogCategory.APPLICATION,
    });
  }

  http(message: string, context: LogContext = {}): void {
    this.log(LogLevel.HTTP, message, {
      ...context,
      category: context.category || LogCategory.API,
    });
  }

  debug(message: string, context: LogContext = {}): void {
    this.log(LogLevel.DEBUG, message, {
      ...context,
      category: context.category || LogCategory.APPLICATION,
    });
  }

  // Specialized logging methods
  security(message: string, context: SecurityLogContext): void {
    this.log(LogLevel.INFO, message, {
      ...context,
      category: LogCategory.SECURITY,
    });
  }

  performance(message: string, context: PerformanceLogContext): void {
    this.log(LogLevel.INFO, message, {
      ...context,
      category: LogCategory.PERFORMANCE,
    });
  }

  audit(message: string, context: AuditLogContext): void {
    this.log(LogLevel.INFO, message, {
      ...context,
      category: LogCategory.AUDIT,
    });
  }

  // Device-specific logging
  device(message: string, deviceId: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, {
      ...context,
      deviceId,
      category: LogCategory.DEVICE,
    });
  }

  // N8N-specific logging
  n8n(message: string, context: LogContext = {}): void {
    this.log(LogLevel.INFO, message, {
      ...context,
      category: LogCategory.N8N,
    });
  }

  // API request logging
  apiRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    context: LogContext = {}
  ): void {
    const level =
      statusCode >= 500
        ? LogLevel.ERROR
        : statusCode >= 400
          ? LogLevel.WARN
          : LogLevel.INFO;

    this.log(level, `${method} ${url} ${statusCode} - ${responseTime}ms`, {
      ...context,
      method,
      url,
      statusCode,
      responseTime,
      category: LogCategory.API,
    });
  }

  // Database operation logging
  database(
    operation: string,
    duration: number,
    context: LogContext = {}
  ): void {
    const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;

    this.log(level, `Database ${operation} completed in ${duration}ms`, {
      ...context,
      operation,
      duration,
      category: LogCategory.DATABASE,
    });
  }

  // Cache operation logging
  cache(
    operation: string,
    key: string,
    hit: boolean,
    context: LogContext = {}
  ): void {
    this.log(
      LogLevel.DEBUG,
      `Cache ${operation}: ${key} (${hit ? 'HIT' : 'MISS'})`,
      {
        ...context,
        operation,
        key,
        hit,
        category: LogCategory.CACHE,
      }
    );
  }

  // Correlation ID helpers
  child(context: LogContext): LoggerService {
    const childLogger = new LoggerService();
    // Store context for child logger
    (childLogger as any).childContext = context;
    return childLogger;
  }

  // Express middleware for request logging
  getRequestMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();

      // Generate request ID if not present
      if (!req.requestId) {
        req.requestId = require('crypto').randomUUID();
      }

      // Log request start
      this.http(`${req.method} ${req.originalUrl} - Request started`, {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
      });

      // Override res.end to log response
      const originalEnd = res.end;
      const self = this;
      res.end = function (chunk: any, encoding: any) {
        const responseTime = Date.now() - startTime;

        // Log response
        self.apiRequest(
          req.method,
          req.originalUrl,
          res.statusCode,
          responseTime,
          {
            requestId: req.requestId,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.id,
          }
        );

        originalEnd.call(res, chunk, encoding);
      };

      const childLogger = this.child({ requestId: req.requestId });
      req.logger = childLogger;

      next();
    };
  }

  // Log cleanup (remove old log files)
  cleanup(daysToKeep: number = 30): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      files.forEach((file) => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          this.info(`Cleaned up old log file: ${file}`);
        }
      });
    } catch (error) {
      this.error('Failed to cleanup log files', error as Error);
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.info('Shutting down logger service');
    // In a real implementation, we would flush any pending writes
    return Promise.resolve();
  }
}

// Export singleton instance
export const logger = LoggerService.getInstance();

// Utility functions
export function createRequestContext(req: any): LogContext {
  return {
    requestId: req.requestId,
    userId: req.user?.id,
    sessionId: req.sessionID,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    url: req.originalUrl,
  };
}

export function logError(
  error: Error | AppError,
  context: LogContext = {}
): void {
  logger.error('Unhandled error occurred', error, context);
}

export function logSecurityEvent(
  event: string,
  severity: SecurityLogContext['severity'],
  outcome: SecurityLogContext['outcome'],
  context: Partial<SecurityLogContext> = {}
): void {
  logger.security(`Security event: ${event}`, {
    ...context,
    category: LogCategory.SECURITY,
    securityEvent: event,
    severity,
    outcome,
  });
}

export function logPerformanceMetric(
  operation: string,
  duration: number,
  context: Partial<PerformanceLogContext> = {}
): void {
  logger.performance(`Performance: ${operation} completed in ${duration}ms`, {
    ...context,
    category: LogCategory.PERFORMANCE,
    operation,
    duration,
  });
}

export function logAuditEvent(
  action: string,
  resource: string,
  outcome: AuditLogContext['outcome'],
  context: Partial<AuditLogContext> = {}
): void {
  logger.audit(`Audit: ${action} on ${resource}`, {
    ...context,
    category: LogCategory.AUDIT,
    action,
    resource,
    outcome,
  });
}
