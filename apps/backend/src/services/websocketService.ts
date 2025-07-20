import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Logger } from '@n8n-streamdeck/shared';
import { config } from '../config/environment';
import { StreamDeckService } from './streamDeckService';

export class WebSocketService {
  private static instance: WebSocketService;
  private io: SocketIOServer | null = null;
  private logger: Logger;
  private streamDeckService: StreamDeckService;
  private connectedClients = new Set<Socket>();

  constructor() {
    this.logger = new Logger({ level: config.logLevel }, 'WebSocketService');
    this.streamDeckService = StreamDeckService.getInstance();
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  initialize(httpServer: HttpServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupEventListeners();
    this.setupStreamDeckEventListeners();

    this.logger.info('WebSocket service initialized', {
      corsOrigins: config.corsOrigins,
    });
  }

  private setupEventListeners(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      this.connectedClients.add(socket);

      this.logger.info('Client connected', {
        socketId: socket.id,
        clientsCount: this.connectedClients.size,
      });

      // Send current device status to newly connected client
      this.sendDeviceStatusToClient(socket);

      socket.on('disconnect', (reason) => {
        this.connectedClients.delete(socket);
        this.logger.info('Client disconnected', {
          socketId: socket.id,
          reason,
          clientsCount: this.connectedClients.size,
        });
      });

      // Handle client events
      socket.on('device:connect', async (deviceId: string) => {
        try {
          await this.streamDeckService.connectToDevice(deviceId);
          this.logger.info('Device connected via WebSocket', {
            deviceId,
            socketId: socket.id,
          });
        } catch (error) {
          this.logger.error(
            'Failed to connect device via WebSocket',
            error as Error,
            {
              deviceId,
              socketId: socket.id,
            }
          );
          socket.emit('device:error', {
            deviceId,
            error: (error as Error).message,
          });
        }
      });

      socket.on('device:disconnect', async (deviceId: string) => {
        try {
          await this.streamDeckService.disconnectDevice(deviceId);
          this.logger.info('Device disconnected via WebSocket', {
            deviceId,
            socketId: socket.id,
          });
        } catch (error) {
          this.logger.error(
            'Failed to disconnect device via WebSocket',
            error as Error,
            {
              deviceId,
              socketId: socket.id,
            }
          );
          socket.emit('device:error', {
            deviceId,
            error: (error as Error).message,
          });
        }
      });

      socket.on(
        'button:press',
        (data: { deviceId: string; buttonIndex: number }) => {
          this.logger.info('Button press simulated via WebSocket', {
            deviceId: data.deviceId,
            buttonIndex: data.buttonIndex,
            socketId: socket.id,
          });

          // Broadcast button press event to all clients
          this.broadcast('button:pressed', {
            deviceId: data.deviceId,
            buttonIndex: data.buttonIndex,
            timestamp: Date.now(),
          });
        }
      );
    });
  }

  private setupStreamDeckEventListeners(): void {
    // Listen for StreamDeck service events and broadcast to clients
    this.streamDeckService.on('deviceConnected', (event) => {
      this.logger.info('Broadcasting device connected event', {
        deviceId: event.device.id,
        clientsCount: this.connectedClients.size,
      });

      this.broadcast('device:connected', {
        type: 'device-connected',
        deviceId: event.device.id,
        device: {
          ...event.device,
          connected: event.device.isConnected,
          createdAt: event.device.createdAt.toISOString(),
          updatedAt: event.device.updatedAt.toISOString(),
        },
        timestamp: event.timestamp,
      });
    });

    this.streamDeckService.on('deviceDisconnected', (event) => {
      this.logger.info('Broadcasting device disconnected event', {
        deviceId: event.deviceId,
        clientsCount: this.connectedClients.size,
      });

      this.broadcast('device:disconnected', {
        type: 'device-disconnected',
        deviceId: event.deviceId,
        device: event.device
          ? {
              ...event.device,
              connected: event.device.isConnected,
              createdAt: event.device.createdAt.toISOString(),
              updatedAt: event.device.updatedAt.toISOString(),
            }
          : null,
        reason: event.reason,
        timestamp: event.timestamp,
      });
    });

    this.streamDeckService.on('buttonPress', (event) => {
      this.logger.info('Broadcasting button press event', {
        deviceId: event.deviceId,
        buttonIndex: event.buttonIndex,
        clientsCount: this.connectedClients.size,
      });

      this.broadcast('button:pressed', {
        type: 'button-pressed',
        deviceId: event.deviceId,
        buttonIndex: event.buttonIndex,
        pressType: event.pressType,
        duration: event.duration,
        timestamp: event.timestamp,
      });
    });

    this.streamDeckService.on('deviceError', (event) => {
      this.logger.warn('Broadcasting device error event', {
        deviceId: event.deviceId,
        error: event.error.message,
        clientsCount: this.connectedClients.size,
      });

      this.broadcast('device:error', {
        type: 'device-error',
        deviceId: event.deviceId,
        error: event.error,
        timestamp: event.timestamp,
      });
    });
  }

  private async sendDeviceStatusToClient(socket: Socket): Promise<void> {
    try {
      const devices = await this.streamDeckService.discoverDevices();
      const deviceStatus = devices.map((device) => ({
        ...device,
        connected: device.isConnected,
        createdAt: device.createdAt.toISOString(),
        updatedAt: device.updatedAt.toISOString(),
      }));

      socket.emit('devices:status', {
        devices: deviceStatus,
        timestamp: Date.now(),
      });

      this.logger.debug('Sent device status to client', {
        socketId: socket.id,
        deviceCount: devices.length,
      });
    } catch (error) {
      this.logger.error(
        'Failed to send device status to client',
        error as Error,
        {
          socketId: socket.id,
        }
      );
    }
  }

  private broadcast(event: string, data: any): void {
    if (!this.io) return;

    this.io.emit(event, data);

    this.logger.debug('Broadcasted event', {
      event,
      clientsCount: this.connectedClients.size,
      dataKeys: Object.keys(data),
    });
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down WebSocket service');

    if (this.io) {
      // Disconnect all clients
      this.io.disconnectSockets(true);

      // Close the server
      this.io.close();
      this.io = null;
    }

    this.connectedClients.clear();
    this.logger.info('WebSocket service shutdown completed');
  }
}
