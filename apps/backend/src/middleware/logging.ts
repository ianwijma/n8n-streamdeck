import { Request, Response, NextFunction } from 'express';
import { Logger, generateUUID } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';

// Create logger instance
const logger = new Logger({ level: config.logLevel }, 'HTTP');

// Extend Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = generateUUID();
  req.startTime = Date.now();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);
  
  next();
};

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const { method, url, ip, headers } = req;
  const userAgent = headers['user-agent'] || 'Unknown';
  
  // Log incoming request
  logger.info(`${method} ${url}`, {
    requestId: req.requestId,
    ip,
    userAgent,
    contentLength: headers['content-length'],
    contentType: headers['content-type'],
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
    const duration = Date.now() - req.startTime;
    const { statusCode } = res;
    const contentLength = res.getHeader('content-length');

    // Log response
    const logLevel = statusCode >= 400 ? 'warn' : 'info';
    logger[logLevel](`${method} ${url} - ${statusCode}`, {
      requestId: req.requestId,
      statusCode,
      duration: `${duration}ms`,
      contentLength,
      ip,
      userAgent,
    });

    // Call original end method and return the result
    return originalEnd(chunk, encoding, cb);
  };

  next();
};

export const errorLoggingMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { method, url, ip } = req;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  logger.error(`${method} ${url} - Error`, error, {
    requestId: req.requestId,
    ip,
    userAgent,
    stack: error.stack,
  });

  next(error);
};