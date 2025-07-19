export interface AppConfig {
  // Server configuration
  server: {
    port: number;
    host: string;
    cors: {
      enabled: boolean;
      origins: string[];
    };
    rateLimit: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
    };
  };

  // N8N integration configuration
  n8n: {
    baseUrl: string;
    apiKey: string;
    webhookUrl?: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };

  // StreamDeck configuration
  streamdeck: {
    autoConnect: boolean;
    reconnectInterval: number;
    maxReconnectAttempts: number;
    buttonPressTimeout: number;
    longPressThreshold: number;
    doublePressThreshold: number;
  };

  // Database configuration
  database: {
    type: 'sqlite' | 'postgresql' | 'mysql';
    host?: string;
    port?: number;
    database: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    connectionTimeout: number;
    maxConnections: number;
  };

  // Logging configuration
  logging: {
    level: LogLevel;
    format: 'json' | 'text';
    file: {
      enabled: boolean;
      path: string;
      maxSize: string;
      maxFiles: number;
    };
    console: {
      enabled: boolean;
      colorize: boolean;
    };
  };

  // Security configuration
  security: {
    auth: AuthConfig;
    encryption: {
      algorithm: string;
      keyLength: number;
    };
    session: {
      secret: string;
      maxAge: number;
      secure: boolean;
    };
  };

  // Feature flags
  features: {
    webInterface: boolean;
    apiDocumentation: boolean;
    metrics: boolean;
    healthCheck: boolean;
    deviceDiscovery: boolean;
    profileSync: boolean;
  };

  // Image processing configuration
  images: {
    maxSize: number; // in bytes
    allowedFormats: string[];
    quality: number; // 1-100
    cacheEnabled: boolean;
    cacheTtl: number; // in seconds
  };
}

export interface AuthConfig {
  enabled: boolean;
  type: 'none' | 'basic' | 'jwt' | 'oauth';
  
  // Basic auth configuration
  basic?: {
    username: string;
    password: string;
  };

  // JWT configuration
  jwt?: {
    secret: string;
    expiresIn: string;
    issuer: string;
    audience: string;
    algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  };

  // OAuth configuration
  oauth?: {
    provider: 'google' | 'github' | 'microsoft' | 'custom';
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
    authUrl?: string;
    tokenUrl?: string;
    userInfoUrl?: string;
  };
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
}

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'mysql';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  connectionTimeout: number;
  maxConnections: number;
  migrations: {
    enabled: boolean;
    directory: string;
  };
}

export interface N8NConfig {
  baseUrl: string;
  apiKey: string;
  webhookUrl?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
}

export interface StreamDeckConfig {
  autoConnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  buttonPressTimeout: number;
  longPressThreshold: number;
  doublePressThreshold: number;
  brightness: {
    default: number;
    min: number;
    max: number;
  };
  profiles: {
    autoSave: boolean;
    backupEnabled: boolean;
    backupInterval: number;
  };
}

// Environment-specific configurations
export interface EnvironmentConfig {
  development: Partial<AppConfig>;
  production: Partial<AppConfig>;
  test: Partial<AppConfig>;
}

// Configuration validation schema
export interface ConfigValidation {
  required: string[];
  optional: string[];
  types: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
  defaults: Partial<AppConfig>;
}

// Default configuration values
export const DEFAULT_CONFIG: AppConfig = {
  server: {
    port: 3000,
    host: '0.0.0.0',
    cors: {
      enabled: true,
      origins: ['http://localhost:3000', 'http://localhost:3001'],
    },
    rateLimit: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
    },
  },
  n8n: {
    baseUrl: 'http://localhost:5678',
    apiKey: '',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  streamdeck: {
    autoConnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    buttonPressTimeout: 5000,
    longPressThreshold: 1000,
    doublePressThreshold: 300,
  },
  database: {
    type: 'sqlite',
    database: 'streamdeck.db',
    connectionTimeout: 10000,
    maxConnections: 10,
  },
  logging: {
    level: LogLevel.INFO,
    format: 'text',
    file: {
      enabled: true,
      path: 'logs/app.log',
      maxSize: '10MB',
      maxFiles: 5,
    },
    console: {
      enabled: true,
      colorize: true,
    },
  },
  security: {
    auth: {
      enabled: false,
      type: 'none',
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
    },
    session: {
      secret: 'change-me-in-production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: false,
    },
  },
  features: {
    webInterface: true,
    apiDocumentation: true,
    metrics: true,
    healthCheck: true,
    deviceDiscovery: true,
    profileSync: true,
  },
  images: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'svg'],
    quality: 85,
    cacheEnabled: true,
    cacheTtl: 3600, // 1 hour
  },
};

// Utility functions for configuration
export const mergeConfig = (base: AppConfig, override: Partial<AppConfig>): AppConfig => {
  return {
    ...base,
    ...override,
    server: { ...base.server, ...override.server },
    n8n: { ...base.n8n, ...override.n8n },
    streamdeck: { ...base.streamdeck, ...override.streamdeck },
    database: { ...base.database, ...override.database },
    logging: { ...base.logging, ...override.logging },
    security: { ...base.security, ...override.security },
    features: { ...base.features, ...override.features },
    images: { ...base.images, ...override.images },
  };
};

export const validateConfig = (config: Partial<AppConfig>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Basic validation
  if (config.server?.port && (config.server.port < 1 || config.server.port > 65535)) {
    errors.push('Server port must be between 1 and 65535');
  }

  if (config.n8n?.baseUrl && !isValidUrl(config.n8n.baseUrl)) {
    errors.push('N8N base URL must be a valid URL');
  }

  if (config.database?.type && !['sqlite', 'postgresql', 'mysql'].includes(config.database.type)) {
    errors.push('Database type must be sqlite, postgresql, or mysql');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};