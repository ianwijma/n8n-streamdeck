import { LogLevel } from '../types/config';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, any>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  includeTimestamp: boolean;
  includeLevel: boolean;
  includeContext: boolean;
  colorize: boolean;
}

export class Logger {
  private config: LoggerConfig;
  private context?: string;

  constructor(config: Partial<LoggerConfig> = {}, context?: string) {
    this.config = {
      level: LogLevel.INFO,
      format: 'text',
      includeTimestamp: true,
      includeLevel: true,
      includeContext: true,
      colorize: true,
      ...config,
    };
    this.context = context;
  }

  // Create a child logger with a specific context
  child(context: string): Logger {
    return new Logger(this.config, context);
  }

  // Log methods
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  trace(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, metadata);
  }

  // Core logging method
  private log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: this.context,
      metadata,
      error,
    };

    const formatted = this.format(entry);
    this.output(level, formatted);
  }

  // Check if we should log at this level
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG, LogLevel.TRACE];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  // Format log entry
  private format(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        message: entry.message,
        context: entry.context,
        metadata: entry.metadata,
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        } : undefined,
      });
    }

    // Text format
    let formatted = '';

    if (this.config.includeTimestamp) {
      formatted += `[${entry.timestamp.toISOString()}] `;
    }

    if (this.config.includeLevel) {
      const levelStr = this.config.colorize ? this.colorizeLevel(entry.level) : entry.level.toUpperCase();
      formatted += `${levelStr} `;
    }

    if (this.config.includeContext && entry.context) {
      const contextStr = this.config.colorize ? `\x1b[36m[${entry.context}]\x1b[0m` : `[${entry.context}]`;
      formatted += `${contextStr} `;
    }

    formatted += entry.message;

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      formatted += ` ${JSON.stringify(entry.metadata)}`;
    }

    if (entry.error) {
      formatted += `\n${entry.error.stack || entry.error.message}`;
    }

    return formatted;
  }

  // Colorize log level for console output
  private colorizeLevel(level: LogLevel): string {
    const colors = {
      [LogLevel.ERROR]: '\x1b[31mERROR\x1b[0m',   // Red
      [LogLevel.WARN]: '\x1b[33mWARN\x1b[0m',     // Yellow
      [LogLevel.INFO]: '\x1b[32mINFO\x1b[0m',     // Green
      [LogLevel.DEBUG]: '\x1b[34mDEBUG\x1b[0m',   // Blue
      [LogLevel.TRACE]: '\x1b[35mTRACE\x1b[0m',   // Magenta
    };
    return colors[level] || level.toUpperCase();
  }

  // Output log entry (can be overridden for custom outputs)
  protected output(level: LogLevel, message: string): void {
    if (level === LogLevel.ERROR) {
      console.error(message);
    } else if (level === LogLevel.WARN) {
      console.warn(message);
    } else {
      console.log(message);
    }
  }

  // Update logger configuration
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Get current configuration
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

// Default logger instance
export const logger = new Logger();

// Utility functions
export const createLogger = (context: string, config?: Partial<LoggerConfig>): Logger => {
  return new Logger(config, context);
};

export const setGlobalLogLevel = (level: LogLevel): void => {
  logger.updateConfig({ level });
};

// Performance logging utility
export const measureTime = async <T>(
  operation: () => Promise<T> | T,
  logger: Logger,
  operationName: string
): Promise<T> => {
  const start = Date.now();
  logger.debug(`Starting ${operationName}`);
  
  try {
    const result = await operation();
    const duration = Date.now() - start;
    logger.debug(`Completed ${operationName}`, { duration: `${duration}ms` });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`Failed ${operationName}`, error as Error, { duration: `${duration}ms` });
    throw error;
  }
};

// Request logging utility
export const logRequest = (
  logger: Logger,
  method: string,
  url: string,
  statusCode?: number,
  duration?: number,
  userAgent?: string
): void => {
  const metadata: Record<string, any> = {
    method,
    url,
    statusCode,
    duration: duration ? `${duration}ms` : undefined,
    userAgent,
  };

  const message = `${method} ${url}${statusCode ? ` - ${statusCode}` : ''}${duration ? ` (${duration}ms)` : ''}`;

  if (statusCode && statusCode >= 400) {
    logger.warn(message, metadata);
  } else {
    logger.info(message, metadata);
  }
};