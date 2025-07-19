import dotenv from 'dotenv';
import { AppConfig, LogLevel } from '@n8n-streamdeck/shared';

// Load environment variables
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: string;
  corsOrigins: string[];
  logLevel: LogLevel;
  n8n: {
    baseUrl: string;
    apiKey: string;
    timeout: number;
  };
  streamdeck: {
    autoConnect: boolean;
    reconnectInterval: number;
  };
}

const parseEnvBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
};

const parseEnvNumber = (value: string | undefined, defaultValue: number = 0): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseEnvArray = (value: string | undefined, defaultValue: string[] = []): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

const parseLogLevel = (value: string | undefined): LogLevel => {
  const level = value?.toLowerCase();
  switch (level) {
    case 'error': return LogLevel.ERROR;
    case 'warn': return LogLevel.WARN;
    case 'info': return LogLevel.INFO;
    case 'debug': return LogLevel.DEBUG;
    case 'trace': return LogLevel.TRACE;
    default: return LogLevel.INFO;
  }
};

export const config: ServerConfig = {
  port: parseEnvNumber(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: parseEnvArray(process.env.CORS_ORIGINS, ['http://localhost:3000', 'http://localhost:3001']),
  logLevel: parseLogLevel(process.env.LOG_LEVEL),
  
  n8n: {
    baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
    apiKey: process.env.N8N_API_KEY || '',
    timeout: parseEnvNumber(process.env.N8N_TIMEOUT, 30000),
  },
  
  streamdeck: {
    autoConnect: parseEnvBoolean(process.env.STREAMDECK_AUTO_CONNECT, true),
    reconnectInterval: parseEnvNumber(process.env.STREAMDECK_RECONNECT_INTERVAL, 5000),
  },
};

// Validate required configuration
export const validateConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (config.port < 1 || config.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (!config.n8n.baseUrl) {
    errors.push('N8N_BASE_URL is required');
  }

  try {
    new URL(config.n8n.baseUrl);
  } catch {
    errors.push('N8N_BASE_URL must be a valid URL');
  }

  if (config.n8n.timeout < 1000) {
    errors.push('N8N_TIMEOUT must be at least 1000ms');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Development helpers
export const isDevelopment = (): boolean => config.nodeEnv === 'development';
export const isProduction = (): boolean => config.nodeEnv === 'production';
export const isTest = (): boolean => config.nodeEnv === 'test';