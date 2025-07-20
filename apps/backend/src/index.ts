import { Server } from 'http';
import { Logger } from '@n8n-streamdeck/shared';
import { config } from './config/environment';
import { createApp } from './app';
import { StreamDeckService } from './services/streamDeckService';
import { WebSocketService } from './services/websocketService';

const logger = new Logger({ level: config.logLevel }, 'Server');

let server: Server;

const startServer = async (): Promise<void> => {
  try {
    // Create Express application
    const app = createApp();

    // Initialize StreamDeck service and discover devices
    const streamDeckService = StreamDeckService.getInstance();

    // Start HTTP server
    server = app.listen(config.port, config.host, async () => {
      // Initialize WebSocket service after server starts
      const webSocketService = WebSocketService.getInstance();
      webSocketService.initialize(server);
      logger.info('Server started successfully', {
        port: config.port,
        host: config.host,
        nodeEnv: config.nodeEnv,
        pid: process.pid,
        nodeVersion: process.version,
      });

      logger.info('Available endpoints:', {
        root: `http://${config.host}:${config.port}/`,
        health: `http://${config.host}:${config.port}/health`,
        api: {
          devices: `http://${config.host}:${config.port}/api/devices`,
          buttons: `http://${config.host}:${config.port}/api/buttons`,
          config: `http://${config.host}:${config.port}/api/config`,
          health: `http://${config.host}:${config.port}/api/health`,
        },
      });

      // Discover and auto-connect to StreamDeck devices
      try {
        logger.info('Starting StreamDeck device discovery...');
        const devices = await streamDeckService.discoverDevices();
        logger.info(`Discovered ${devices.length} StreamDeck device(s)`);

        // Auto-connect to discovered devices if autoConnect is enabled
        if (config.streamdeck.autoConnect && devices.length > 0) {
          logger.info('Auto-connecting to discovered devices...');
          const connectionPromises = devices.map(async (device) => {
            try {
              await streamDeckService.connectToDevice(device.id);
              logger.info(
                `Successfully connected to device: ${device.name} (${device.id})`
              );
            } catch (error) {
              logger.error(
                `Failed to connect to device: ${device.name} (${device.id})`,
                error as Error
              );
            }
          });

          await Promise.allSettled(connectionPromises);
          const connectedDevices = streamDeckService.getConnectedDevices();
          logger.info(
            `Auto-connection completed. ${connectedDevices.length}/${devices.length} devices connected`
          );
        }
      } catch (error) {
        logger.error('Failed to discover StreamDeck devices', error as Error);
      }
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use`, error);
      } else if (error.code === 'EACCES') {
        logger.error(`Permission denied to bind to port ${config.port}`, error);
      } else {
        logger.error('Server error', error);
      }
      process.exit(1);
    });

    // Handle server close
    server.on('close', () => {
      logger.info('Server closed');
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  try {
    // Shutdown WebSocket service first
    const webSocketService = WebSocketService.getInstance();
    await webSocketService.shutdown();

    // Shutdown StreamDeck service
    const streamDeckService = StreamDeckService.getInstance();
    await streamDeckService.shutdown();

    if (server) {
      server.close((error) => {
        if (error) {
          logger.error('Error during server shutdown', error);
          process.exit(1);
        }

        logger.info('Server shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.warn('Forcing server shutdown after timeout');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  } catch (error) {
    logger.error('Error during graceful shutdown', error as Error);
    process.exit(1);
  }
};

// Handle process signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled promise rejection', new Error(String(reason)), {
    promise: promise.toString(),
  });
  gracefulShutdown('unhandledRejection');
});

// Start the server
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start application', error);
    process.exit(1);
  });
}

export { startServer, gracefulShutdown };
