import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { 
  listStreamDecks, 
  openStreamDeck, 
  StreamDeck as StreamDeckDevice,
  StreamDeckDeviceInfo
} from '@elgato-stream-deck/node';
import {
  Device,
  DeviceType,
  ButtonPressEvent,
  DeviceConnectedEvent,
  DeviceDisconnectedEvent,
  DeviceErrorEvent,
  Logger,
  generateUUID,
  createEvent,
  EventType
} from '@n8n-streamdeck/shared';
import { config } from '../config/environment';

export interface StreamDeckServiceOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class StreamDeckService extends EventEmitter {
  private logger: Logger;
  private connectedDevices: Map<string, StreamDeckDevice> = new Map();
  private deviceInfo: Map<string, Device> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private options: StreamDeckServiceOptions;

  constructor(options: StreamDeckServiceOptions = {}) {
    super();
    this.logger = new Logger({ level: config.logLevel }, 'StreamDeckService');
    this.options = {
      autoConnect: options.autoConnect ?? config.streamdeck.autoConnect,
      reconnectInterval: options.reconnectInterval ?? config.streamdeck.reconnectInterval,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
    };

    this.logger.info('StreamDeck service initialized', {
      autoConnect: this.options.autoConnect,
      reconnectInterval: this.options.reconnectInterval,
      maxReconnectAttempts: this.options.maxReconnectAttempts,
    });
  }

  /**
   * Discover available StreamDeck devices
   */
  async discoverDevices(): Promise<Device[]> {
    try {
      this.logger.info('Starting device discovery');
      
      const streamDecks = await listStreamDecks();
      const devices: Device[] = [];

      for (const streamDeckInfo of streamDecks) {
        const device = this.mapStreamDeckInfoToDevice(streamDeckInfo);
        devices.push(device);
        this.deviceInfo.set(device.id, device);
        
        this.logger.info('Discovered device', {
          deviceId: device.id,
          name: device.name,
          type: device.type,
          serialNumber: device.serialNumber,
          buttonCount: device.buttonCount,
        });
      }

      this.logger.info(`Discovery completed, found ${devices.length} devices`);
      return devices;
    } catch (error) {
      this.logger.error('Device discovery failed', error as Error);
      throw new Error(`Failed to discover StreamDeck devices: ${(error as Error).message}`);
    }
  }

  /**
   * Connect to a specific StreamDeck device
   */
  async connectToDevice(deviceId: string): Promise<void> {
    try {
      if (this.connectedDevices.has(deviceId)) {
        this.logger.warn('Device already connected', { deviceId });
        return;
      }

      this.logger.info('Connecting to device', { deviceId });

      const device = this.deviceInfo.get(deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not found. Run discoverDevices() first.`);
      }

      // Find the StreamDeck device info
      const streamDecks = await listStreamDecks();
      const streamDeckInfo = streamDecks.find(sd => this.generateDeviceId(sd) === deviceId);
      
      if (!streamDeckInfo) {
        throw new Error(`StreamDeck device ${deviceId} not found during connection`);
      }

      // Open the device
      const streamDeck = await openStreamDeck(streamDeckInfo.path);
      
      // Store the connected device
      this.connectedDevices.set(deviceId, streamDeck);
      
      // Update device info
      device.isConnected = true;
      device.updatedAt = new Date();
      try {
        device.firmwareVersion = await streamDeck.getFirmwareVersion() || 'Unknown';
      } catch {
        device.firmwareVersion = 'Unknown';
      }
      
      // Set up event listeners
      this.setupDeviceEventListeners(deviceId, streamDeck);

      // Clear any reconnect timer
      const reconnectTimer = this.reconnectTimers.get(deviceId);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        this.reconnectTimers.delete(deviceId);
      }

      this.logger.info('Device connected successfully', {
        deviceId,
        firmwareVersion: device.firmwareVersion,
        buttonCount: device.buttonCount,
      });

      // Emit connection event
      const connectionEvent = createEvent<DeviceConnectedEvent>(
        EventType.DEVICE_CONNECTED,
        {
          device,
          isReconnection: false,
        }
      );
      this.emit('deviceConnected', connectionEvent);

    } catch (error) {
      this.logger.error('Failed to connect to device', error as Error, { deviceId });
      
      // Emit error event
      const errorEvent = createEvent<DeviceErrorEvent>(
        EventType.DEVICE_ERROR,
        {
          deviceId,
          device: this.deviceInfo.get(deviceId),
          error: {
            code: 'CONNECTION_FAILED',
            message: (error as Error).message,
          },
        }
      );
      this.emit('deviceError', errorEvent);
      
      throw error;
    }
  }

  /**
   * Disconnect from a specific StreamDeck device
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    try {
      this.logger.info('Disconnecting device', { deviceId });

      const streamDeck = this.connectedDevices.get(deviceId);
      if (!streamDeck) {
        this.logger.warn('Device not connected', { deviceId });
        return;
      }

      // Close the device
      await streamDeck.close();
      
      // Remove from connected devices
      this.connectedDevices.delete(deviceId);
      
      // Update device info
      const device = this.deviceInfo.get(deviceId);
      if (device) {
        device.isConnected = false;
        device.updatedAt = new Date();
      }

      // Clear reconnect timer if exists
      const reconnectTimer = this.reconnectTimers.get(deviceId);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        this.reconnectTimers.delete(deviceId);
      }

      this.logger.info('Device disconnected successfully', { deviceId });

      // Emit disconnection event
      const disconnectionEvent = createEvent<DeviceDisconnectedEvent>(
        EventType.DEVICE_DISCONNECTED,
        {
          deviceId,
          device,
          reason: 'user-disconnect',
        }
      );
      this.emit('deviceDisconnected', disconnectionEvent);

    } catch (error) {
      this.logger.error('Failed to disconnect device', error as Error, { deviceId });
      throw error;
    }
  }

  /**
   * Set button image on a specific device
   */
  async setButtonImage(deviceId: string, buttonIndex: number, imagePath: string): Promise<void> {
    try {
      const streamDeck = this.connectedDevices.get(deviceId);
      if (!streamDeck) {
        throw new Error(`Device ${deviceId} is not connected`);
      }

      const device = this.deviceInfo.get(deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      if (buttonIndex < 0 || buttonIndex >= device.buttonCount) {
        throw new Error(`Button index ${buttonIndex} is out of range for device ${deviceId}`);
      }

      this.logger.info('Setting button image', {
        deviceId,
        buttonIndex,
        imagePath,
      });

      // Read image file
      const imageBuffer = await fs.readFile(imagePath);
      
      // Set the button image
      await streamDeck.fillKeyBuffer(buttonIndex, imageBuffer);

      this.logger.info('Button image set successfully', {
        deviceId,
        buttonIndex,
        imageSize: imageBuffer.length,
      });

    } catch (error) {
      this.logger.error('Failed to set button image', error as Error, {
        deviceId,
        buttonIndex,
        imagePath,
      });
      throw error;
    }
  }

  /**
   * Set up button press event listener
   */
  onButtonPress(callback: (event: ButtonPressEvent) => void): void {
    this.on('buttonPress', callback);
  }

  /**
   * Get all connected devices
   */
  getConnectedDevices(): Device[] {
    return Array.from(this.deviceInfo.values()).filter(device => device.isConnected);
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): Device | undefined {
    return this.deviceInfo.get(deviceId);
  }

  /**
   * Check if device is connected
   */
  isDeviceConnected(deviceId: string): boolean {
    return this.connectedDevices.has(deviceId);
  }

  /**
   * Disconnect all devices and cleanup
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down StreamDeck service');

    // Clear all reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Disconnect all devices
    const disconnectPromises = Array.from(this.connectedDevices.keys()).map(deviceId =>
      this.disconnectDevice(deviceId).catch(error =>
        this.logger.error('Error disconnecting device during shutdown', error, { deviceId })
      )
    );

    await Promise.all(disconnectPromises);
    
    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('StreamDeck service shutdown completed');
  }

  /**
   * Set up event listeners for a connected device
   */
  private setupDeviceEventListeners(deviceId: string, streamDeck: StreamDeckDevice): void {
    // Button press events
    streamDeck.on('down', (control) => {
      if ('index' in control) {
        this.handleButtonPress(deviceId, control.index, 'short');
      }
    });

    streamDeck.on('up', (control) => {
      if ('index' in control) {
        // Handle button release if needed
        this.logger.debug('Button released', { deviceId, buttonIndex: control.index });
      }
    });

    // Device error events
    streamDeck.on('error', (error: unknown) => {
      this.handleDeviceError(deviceId, error instanceof Error ? error : new Error(String(error)));
    });

    // Device disconnection events - using a different approach since 'close' might not be available
    // We'll handle disconnection through error events or polling
  }

  /**
   * Handle button press events
   */
  private handleButtonPress(deviceId: string, buttonIndex: number, pressType: 'short' | 'long' | 'double'): void {
    const device = this.deviceInfo.get(deviceId);
    
    this.logger.info('Button pressed', {
      deviceId,
      buttonIndex,
      pressType,
      deviceName: device?.name,
    });

    const buttonPressEvent = createEvent<ButtonPressEvent>(
      EventType.BUTTON_PRESS,
      {
        deviceId,
        buttonIndex,
        pressType,
        duration: pressType === 'long' ? 1000 : 100, // Mock duration
      }
    );

    this.emit('buttonPress', buttonPressEvent);
  }

  /**
   * Handle device errors
   */
  private handleDeviceError(deviceId: string, error: Error): void {
    this.logger.error('Device error occurred', error, { deviceId });

    const device = this.deviceInfo.get(deviceId);
    const errorEvent = createEvent<DeviceErrorEvent>(
      EventType.DEVICE_ERROR,
      {
        deviceId,
        device,
        error: {
          code: 'DEVICE_ERROR',
          message: error.message,
          details: { stack: error.stack },
        },
      }
    );

    this.emit('deviceError', errorEvent);
  }

  /**
   * Handle device disconnection
   */
  private handleDeviceDisconnection(deviceId: string, reason: 'user-disconnect' | 'cable-unplugged' | 'error' | 'timeout'): void {
    this.logger.warn('Device disconnected unexpectedly', { deviceId, reason });

    // Remove from connected devices
    this.connectedDevices.delete(deviceId);
    
    // Update device info
    const device = this.deviceInfo.get(deviceId);
    if (device) {
      device.isConnected = false;
      device.updatedAt = new Date();
    }

    // Emit disconnection event
    const disconnectionEvent = createEvent<DeviceDisconnectedEvent>(
      EventType.DEVICE_DISCONNECTED,
      {
        deviceId,
        device,
        reason,
      }
    );
    this.emit('deviceDisconnected', disconnectionEvent);

    // Schedule reconnection if auto-reconnect is enabled
    if (this.options.autoConnect && reason !== 'user-disconnect') {
      this.scheduleReconnection(deviceId);
    }
  }

  /**
   * Schedule device reconnection
   */
  private scheduleReconnection(deviceId: string): void {
    if (this.reconnectTimers.has(deviceId)) {
      return; // Already scheduled
    }

    this.logger.info('Scheduling device reconnection', {
      deviceId,
      interval: this.options.reconnectInterval,
    });

    const timer = setTimeout(async () => {
      try {
        this.reconnectTimers.delete(deviceId);
        await this.connectToDevice(deviceId);
      } catch (error) {
        this.logger.error('Reconnection failed', error as Error, { deviceId });
        // Schedule another reconnection attempt
        this.scheduleReconnection(deviceId);
      }
    }, this.options.reconnectInterval);

    this.reconnectTimers.set(deviceId, timer);
  }

  /**
   * Map StreamDeck device info to our Device interface
   */
  private mapStreamDeckInfoToDevice(streamDeckInfo: StreamDeckDeviceInfo): Device {
    const deviceId = this.generateDeviceId(streamDeckInfo);
    
    return {
      id: deviceId,
      name: this.getDeviceName(streamDeckInfo.model),
      type: this.mapDeviceType(streamDeckInfo.model),
      serialNumber: streamDeckInfo.serialNumber || 'Unknown',
      buttonCount: this.getButtonCount(streamDeckInfo.model),
      isConnected: false,
      firmwareVersion: undefined,
      brightness: 75, // Default brightness
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Generate a unique device ID
   */
  private generateDeviceId(streamDeckInfo: StreamDeckDeviceInfo): string {
    return `streamdeck-${streamDeckInfo.serialNumber || streamDeckInfo.path.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }

  /**
   * Get device name from model
   */
  private getDeviceName(model: any): string {
    const modelStr = String(model).toLowerCase();
    
    if (modelStr.includes('mini')) {
      return 'StreamDeck Mini';
    } else if (modelStr.includes('xl')) {
      return 'StreamDeck XL';
    } else if (modelStr.includes('mk2')) {
      return 'StreamDeck MK.2';
    } else if (modelStr.includes('plus')) {
      return 'StreamDeck Plus';
    }
    
    return 'StreamDeck Original';
  }

  /**
   * Map device model to our DeviceType enum
   */
  private mapDeviceType(model: any): DeviceType {
    // Convert model to string for comparison since the API might return different types
    const modelStr = String(model);
    
    if (modelStr.includes('mini') || modelStr.includes('Mini')) {
      return DeviceType.STREAMDECK_MINI;
    } else if (modelStr.includes('xl') || modelStr.includes('XL')) {
      return DeviceType.STREAMDECK_XL;
    } else if (modelStr.includes('mk2') || modelStr.includes('MK2')) {
      return DeviceType.STREAMDECK_MK2;
    } else if (modelStr.includes('plus') || modelStr.includes('Plus')) {
      return DeviceType.STREAMDECK_PLUS;
    }
    
    return DeviceType.STREAMDECK_ORIGINAL;
  }

  /**
   * Get button count for device model
   */
  private getButtonCount(model: any): number {
    const modelStr = String(model).toLowerCase();
    
    if (modelStr.includes('mini')) {
      return 6;
    } else if (modelStr.includes('xl')) {
      return 32;
    } else if (modelStr.includes('plus')) {
      return 8;
    }
    
    return 15; // Default for original StreamDeck
  }
}