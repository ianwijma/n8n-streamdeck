import { PrismaClient } from '../../generated/prisma';
import { logger, LogCategory } from './logger';

class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
    });

    // Log database queries in development
    if (process.env.NODE_ENV === 'development') {
      (this.prisma as any).$on('query', (e: any) => {
        logger.debug('Database Query', {
          category: LogCategory.DATABASE,
          operation: 'query',
          duration: e.duration,
          metadata: {
            query: e.query,
            params: e.params,
          },
        });
      });
    }

    (this.prisma as any).$on('error', (e: any) => {
      logger.error('Database Error', new Error(e.message), {
        category: LogCategory.DATABASE,
      });
    });

    (this.prisma as any).$on('info', (e: any) => {
      logger.info('Database Info', {
        category: LogCategory.DATABASE,
        metadata: { message: e.message },
      });
    });

    (this.prisma as any).$on('warn', (e: any) => {
      logger.warn('Database Warning', {
        category: LogCategory.DATABASE,
        metadata: { message: e.message },
      });
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public getClient(): PrismaClient {
    return this.prisma;
  }

  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Database connected successfully', {
        category: LogCategory.DATABASE,
      });
    } catch (error) {
      logger.error('Failed to connect to database', error as Error, {
        category: LogCategory.DATABASE,
      });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Database disconnected successfully', {
        category: LogCategory.DATABASE,
      });
    } catch (error) {
      logger.error('Failed to disconnect from database', error as Error, {
        category: LogCategory.DATABASE,
      });
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', error as Error, {
        category: LogCategory.DATABASE,
      });
      return false;
    }
  }

  public async runMigrations(): Promise<void> {
    try {
      // For SQLite with Prisma, we use db push in development
      // In production, you might want to use proper migrations
      logger.info('Database schema is managed by Prisma', {
        category: LogCategory.DATABASE,
      });
    } catch (error) {
      logger.error('Failed to run migrations', error as Error, {
        category: LogCategory.DATABASE,
      });
      throw error;
    }
  }

  // Transaction helper
  public async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  // Cleanup method for graceful shutdown
  public async cleanup(): Promise<void> {
    await this.disconnect();
  }
}

export const databaseService = DatabaseService.getInstance();
export { DatabaseService };
