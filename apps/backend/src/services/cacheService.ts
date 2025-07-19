import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

export class CacheService {
  private static instance: CacheService;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private logger: Logger;
  private defaultTTL: number;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.logger = new Logger({ level: config.logLevel }, 'CacheService');
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // Cleanup every minute

    this.logger.info('Cache service initialized', {
      defaultTTL: this.defaultTTL,
      maxSize: this.maxSize,
    });
  }

  static getInstance(options?: CacheOptions): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService(options);
    }
    return CacheService.instance;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);

    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiresAt,
      accessCount: 0,
      lastAccessed: Date.now(),
    });

    this.logger.debug('Cache entry set', { key, ttl: ttl || this.defaultTTL });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.logger.debug('Cache miss', { key });
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.logger.debug('Cache entry expired', { key });
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.logger.debug('Cache hit', { key, accessCount: entry.accessCount });
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug('Cache entry deleted', { key });
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info('Cache cleared', { entriesRemoved: size });
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  } {
    let totalAccess = 0;
    let totalHits = 0;

    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount;
      if (entry.accessCount > 0) totalHits++;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  // Memoization wrapper for functions
  memoize<T extends (...args: any[]) => any>(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string,
    ttl?: number
  ): T {
    const cache = this;

    return ((...args: Parameters<T>) => {
      const key = keyGenerator
        ? keyGenerator(...args)
        : `memoized:${fn.name}:${JSON.stringify(args)}`;

      const cached = cache.get<ReturnType<T>>(key);
      if (cached !== null) {
        return cached;
      }

      const result = fn(...args);
      cache.set(key, result, ttl);
      return result;
    }) as T;
  }

  // Cache with async function support
  async memoizeAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string,
    ttl?: number
  ): Promise<T> {
    const cache = this;

    return (async (...args: Parameters<T>) => {
      const key = keyGenerator
        ? keyGenerator(...args)
        : `memoized:${fn.name}:${JSON.stringify(args)}`;

      const cached = cache.get<ReturnType<T>>(key);
      if (cached !== null) {
        return cached;
      }

      const result = await fn(...args);
      cache.set(key, result, ttl);
      return result;
    }) as T;
  }

  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug('Cache cleanup completed', { expiredCount });
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug('LRU eviction', { evictedKey: oldestKey });
    }
  }

  private estimateMemoryUsage(): number {
    let size = 0;
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // UTF-16 characters
      size += JSON.stringify(entry.value).length * 2;
      size += 32; // Overhead for entry metadata
    }
    return size;
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    this.logger.info('Cache service shutdown completed');
  }
}

// Singleton instance
export const cacheService = CacheService.getInstance();

// Decorators for caching
export function Cached(
  ttl?: number,
  keyGenerator?: (...args: any[]) => string
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const cache = CacheService.getInstance();
      const key = keyGenerator
        ? keyGenerator(...args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      const cached = cache.get(key);
      if (cached !== null) {
        return cached;
      }

      const result = method.apply(this, args);
      cache.set(key, result, ttl);
      return result;
    };
  };
}

export function CachedAsync(
  ttl?: number,
  keyGenerator?: (...args: any[]) => string
) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cache = CacheService.getInstance();
      const key = keyGenerator
        ? keyGenerator(...args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      const cached = cache.get(key);
      if (cached !== null) {
        return cached;
      }

      const result = await method.apply(this, args);
      cache.set(key, result, ttl);
      return result;
    };
  };
}
