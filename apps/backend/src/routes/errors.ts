import { Router, Request, Response } from 'express';
import { Logger, LogLevel } from '@n8n-streamdeck/shared';
import { z } from 'zod';

const router = Router();
const logger = new Logger({ level: LogLevel.DEBUG }, 'error-reporting');

// Error report schema for validation
const ErrorReportSchema = z.object({
  message: z.string().min(1).max(1000),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  level: z.enum(['error', 'warn', 'info']).default('error'),
  context: z.record(z.any()).optional(),
  timestamp: z.string().datetime().optional(),
  userAgent: z.string().optional(),
  url: z.string().url().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  errorBoundary: z.string().optional(),
  retryCount: z.number().min(0).max(10).optional(),
});

type ErrorReport = z.infer<typeof ErrorReportSchema>;

/**
 * POST /api/errors/report
 * Report client-side errors to the backend for logging and monitoring
 */
router.post('/report', async (req: Request, res: Response) => {
  try {
    // Validate the error report
    const errorReport: ErrorReport = ErrorReportSchema.parse(req.body);

    // Extract client information
    const clientInfo = {
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('User-Agent') || errorReport.userAgent,
      referer: req.get('Referer'),
      timestamp: errorReport.timestamp || new Date().toISOString(),
    };

    // Create structured log entry
    const logEntry = {
      type: 'client_error',
      message: errorReport.message,
      stack: errorReport.stack,
      componentStack: errorReport.componentStack,
      level: errorReport.level,
      context: {
        ...errorReport.context,
        client: clientInfo,
        errorBoundary: errorReport.errorBoundary,
        retryCount: errorReport.retryCount,
        url: errorReport.url,
        userId: errorReport.userId,
        sessionId: errorReport.sessionId,
      },
      logCategory: 'frontend',
      severity: errorReport.level === 'error' ? 'high' : 'medium',
    };

    // Log based on severity level
    switch (errorReport.level) {
      case 'error':
        logger.error('Client-side error reported', undefined, logEntry);
        break;
      case 'warn':
        logger.warn('Client-side warning reported', logEntry);
        break;
      case 'info':
        logger.info('Client-side info reported', logEntry);
        break;
    }

    // For critical errors, also log to security category
    if (
      errorReport.level === 'error' &&
      errorReport.context?.level === 'critical'
    ) {
      logger.error('Critical client-side error', undefined, {
        ...logEntry,
        securityCategory: 'critical_error',
        alert: true,
      });
    }

    // For critical errors, also log to security category
    if (
      errorReport.level === 'error' &&
      errorReport.context?.level === 'critical'
    ) {
      logger.error('Critical client-side error', undefined, {
        ...logEntry,
        securityCategory: 'critical_error',
        alert: true,
      });
    }

    // Return success response with error ID for tracking
    const errorId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    res.status(200).json({
      success: true,
      errorId,
      message: 'Error report received and logged',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      logger.warn('Invalid error report received', {
        type: 'validation_error',
        errors: error.errors,
        body: req.body,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid error report format',
        details: error.errors,
      });
    }

    // Handle other errors
    logger.error(
      'Failed to process error report',
      error instanceof Error ? error : undefined,
      {
        type: 'internal_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
        ip: req.ip,
      }
    );

    res.status(500).json({
      success: false,
      error: 'Failed to process error report',
    });
  }
});

/**
 * POST /api/errors/critical
 * Handle critical errors that require immediate attention
 */
router.post('/critical', async (req: Request, res: Response) => {
  try {
    const { error, stack, componentStack, timestamp } = req.body;

    const criticalError = {
      type: 'critical_client_error',
      message: error || 'Critical client error',
      stack,
      componentStack,
      timestamp: timestamp || new Date().toISOString(),
      client: {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
      },
      logCategory: 'security',
      severity: 'critical',
      alert: true,
    };

    // Log critical error
    logger.error(
      'CRITICAL: Client application error',
      undefined,
      criticalError
    );

    // In production, you might want to:
    // - Send alerts to monitoring systems
    // - Notify on-call engineers
    // - Create incident tickets
    // - Send to error tracking services (Sentry, Bugsnag, etc.)

    res.status(200).json({
      success: true,
      message: 'Critical error logged',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      'Failed to process critical error report',
      error instanceof Error ? error : undefined,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      }
    );

    // Always return success for critical errors to avoid client-side loops
    res.status(200).json({
      success: true,
      message: 'Error acknowledged',
    });
  }
});

/**
 * GET /api/errors/health
 * Health check endpoint for error reporting service
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    service: 'error-reporting',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      report: '/api/errors/report',
      critical: '/api/errors/critical',
    },
  });
});

export default router;
