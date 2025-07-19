/**
 * Frontend Error Reporting Service
 *
 * This service handles error logging and reporting for the frontend application:
 * - Local error logging
 * - Remote error reporting to backend
 * - Error context collection
 * - Retry logic for failed reports
 */

interface ErrorContext {
  level?: 'page' | 'component' | 'critical';
  componentStack?: string;
  errorBoundary?: string;
  retryCount?: number;
  timestamp?: string;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

interface ErrorReport {
  message: string;
  stack?: string;
  context: ErrorContext;
  fingerprint: string;
  timestamp: string;
  sessionId: string;
  userId?: string;
}

class ErrorReportingService {
  private static instance: ErrorReportingService;
  private reportQueue: ErrorReport[] = [];
  private isOnline = true;
  private maxQueueSize = 100;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    this.setupOnlineStatusListener();
    this.setupUnloadHandler();
    this.processQueuePeriodically();
  }

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService();
    }
    return ErrorReportingService.instance;
  }

  /**
   * Log error locally (console, localStorage, etc.)
   */
  logError(error: Error, context: ErrorContext = {}): void {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🐛 Frontend Error');
      console.error('Error:', error);
      console.error('Context:', context);
      console.groupEnd();
    }

    // Store in localStorage for debugging (keep last 50 errors)
    try {
      const storedErrors = JSON.parse(
        localStorage.getItem('app_errors') || '[]'
      );
      storedErrors.push(errorData);

      // Keep only last 50 errors
      if (storedErrors.length > 50) {
        storedErrors.splice(0, storedErrors.length - 50);
      }

      localStorage.setItem('app_errors', JSON.stringify(storedErrors));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  /**
   * Report error to backend service
   */
  async reportError(error: Error, context: ErrorContext = {}): Promise<void> {
    const report: ErrorReport = {
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
      fingerprint: this.generateFingerprint(error, context),
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(),
      userId: this.getUserId(),
    };

    // Add to queue
    this.addToQueue(report);

    // Try to send immediately if online
    if (this.isOnline) {
      await this.processQueue();
    }
  }

  /**
   * Generate error fingerprint for deduplication
   */
  private generateFingerprint(error: Error, context: ErrorContext): string {
    const key = `${error.name}:${error.message}:${context.componentStack || 'unknown'}`;
    return btoa(key)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 32);
  }

  /**
   * Add error report to queue
   */
  private addToQueue(report: ErrorReport): void {
    this.reportQueue.push(report);

    // Prevent queue from growing too large
    if (this.reportQueue.length > this.maxQueueSize) {
      this.reportQueue.shift(); // Remove oldest error
    }
  }

  /**
   * Process error report queue
   */
  private async processQueue(): Promise<void> {
    if (this.reportQueue.length === 0 || !this.isOnline) {
      return;
    }

    const reportsToSend = [...this.reportQueue];
    this.reportQueue = [];

    for (const report of reportsToSend) {
      try {
        await this.sendReport(report);
      } catch (error) {
        // Re-add to queue for retry
        this.reportQueue.unshift(report);
        console.warn('Failed to send error report:', error);
        break; // Stop processing if one fails
      }
    }
  }

  /**
   * Send individual error report
   */
  private async sendReport(report: ErrorReport, attempt = 1): Promise<void> {
    try {
      const response = await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (attempt < this.retryAttempts) {
        // Retry with exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1))
        );
        return this.sendReport(report, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Setup online/offline status listener
   */
  private setupOnlineStatusListener(): void {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.processQueue(); // Process queued reports when back online
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }
  }

  /**
   * Setup page unload handler to send remaining reports
   */
  private setupUnloadHandler(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        // Use sendBeacon for reliable delivery during page unload
        if (this.reportQueue.length > 0 && navigator.sendBeacon) {
          const reports = [...this.reportQueue];
          navigator.sendBeacon(
            '/api/errors/report-batch',
            JSON.stringify({ reports })
          );
        }
      });
    }
  }

  /**
   * Process queue periodically
   */
  private processQueuePeriodically(): void {
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.processQueue();
      }, 30000); // Process every 30 seconds
    }
  }

  /**
   * Get session ID from storage or generate new one
   */
  private getSessionId(): string {
    if (typeof window === 'undefined') return 'server';

    let sessionId = sessionStorage.getItem('app_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      sessionStorage.setItem('app_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Get user ID from authentication context
   */
  private getUserId(): string | undefined {
    // This would typically come from your auth context
    // For now, return undefined
    return undefined;
  }

  /**
   * Get stored errors for debugging
   */
  getStoredErrors(): any[] {
    if (typeof window === 'undefined') return [];

    try {
      return JSON.parse(localStorage.getItem('app_errors') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear stored errors
   */
  clearStoredErrors(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app_errors');
    }
  }

  /**
   * Get error reporting statistics
   */
  getStats(): {
    queueSize: number;
    isOnline: boolean;
    sessionId: string;
    storedErrorsCount: number;
  } {
    return {
      queueSize: this.reportQueue.length,
      isOnline: this.isOnline,
      sessionId: this.getSessionId(),
      storedErrorsCount: this.getStoredErrors().length,
    };
  }
}

// Export singleton instance
const errorReportingService = ErrorReportingService.getInstance();

// Export convenience functions
export const logError = (error: Error, context?: ErrorContext) => {
  errorReportingService.logError(error, context);
};

export const reportError = (error: Error, context?: ErrorContext) => {
  errorReportingService.reportError(error, context);
};

export const getErrorStats = () => {
  return errorReportingService.getStats();
};

export const getStoredErrors = () => {
  return errorReportingService.getStoredErrors();
};

export const clearStoredErrors = () => {
  errorReportingService.clearStoredErrors();
};

// Global error handlers
if (typeof window !== 'undefined') {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

    logError(error, {
      type: 'unhandledRejection',
      level: 'critical',
    });

    reportError(error, {
      type: 'unhandledRejection',
      level: 'critical',
    });
  });

  // Handle global JavaScript errors
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message);

    logError(error, {
      type: 'globalError',
      level: 'critical',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });

    reportError(error, {
      type: 'globalError',
      level: 'critical',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
}

export default errorReportingService;
