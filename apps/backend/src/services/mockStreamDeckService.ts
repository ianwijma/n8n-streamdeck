import { EventEmitter } from 'events';
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

/**
 * Mock StreamDeck service for testing without physical devices
 */
export class MockStreamDeckService extends EventEmitter {
  private logger: Logger;
  private mockDevices: Device[] = [];
  private connectedDevices: Set<string> = new Set();
  private buttonPressSimulator?: NodeJS.Timeout;

  constructor() {
    super();
    this.logger = new Logger({ level: config.logLevel }, 'MockStreamDeckService');
    this.initializeMockDevices();
    
    this.logger.info('Mock StreamDeck service initialized');
  }

  /**
   * Initialize mock devices for testing
   */
  private initializeMockDevices(): void {
    this.mockDevices = [
      {
        id: 'mock-streamdeck-original-001',
        name: 'Mock StreamDeck Original',
        type: DeviceType.STREAMDECK_ORIGINAL,
        serialNumber: 'MOCK001234567890',
        buttonCount: 15,
        isConnected: false,
        firmwareVersion: '1.0.3',
        brightness: 75,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date(),
      },
      {
        id: 'mock-streamdeck-mini-001',
        name: 'Mock StreamDeck Mini',
        type: DeviceType.STREAMDECK_MINI,
        serialNumber: 'MOCK001234567891',
        buttonCount: 6,
        isConnected: false,
        firmwareVersion: '1.0.2',
        brightness: 50,
        createdAt: new Date('2024-01-02T00:00:00Z'),
        updatedAt: new Date(),
      },
      {
        id: 'mock-streamdeck-xl-001',
        name: 'Mock StreamDeck XL',
        type: DeviceType.STREAMDECK_XL,
        serialNumber: 'MOCK001234567892',
        buttonCount: 32,
        isConnected: false,
        firmwareVersion: '1.0.4',
        brightness: 100,
        createdAt: new Date('2024-01-03T00:00:00Z'),
        updatedAt: new Date(),
      },
    ];
  }

  /**
   * Discover available mock StreamDeck devices
   */
  async discoverDevices(): Promise<Device[]> {
    this.logger.info('Discovering mock devices');
    
    // Simulate discovery delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.logger.info(`Mock discovery completed, found ${this.mockDevices.length} devices`);
    return [...this.mockDevices];
  }

  /**
   * Connect to a mock StreamDeck device
   */
  async connectToDevice(deviceId: string): Promise<void> {
    this.logger.info('Connecting to mock device', { deviceId });

    const device = this.mockDevices.find(d => d.id === deviceId);
    if (!device) {
      throw new Error(`Mock device ${deviceId} not found`);
    }

    if (this.connectedDevices.has(deviceId)) {
      this.logger.warn('Mock device already connected', { deviceId });
      return;
    }

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update device state
    device.isConnected = true;
    device.updatedAt = new Date();
    this.connectedDevices.add(deviceId);

    this.logger.info('Mock device connected successfully', { deviceId });

    // Emit connection event
    const connectionEvent = createEvent<DeviceConnectedEvent>(
      EventType.DEVICE_CONNECTED,
      {
        device,
        isReconnection: false,
      }
    );
    this.emit('deviceConnected', connectionEvent);

    // Start simulating button presses
    this.startButtonPressSimulation(deviceId);
  }

  /**
   * Disconnect from a mock StreamDeck device
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    this.logger.info('Disconnecting mock device', { deviceId });

    const device = this.mockDevices.find(d => d.id === deviceId);
    if (!device) {
      throw new Error(`Mock device ${deviceId} not found`);
    }

    if (!this.connectedDevices.has(deviceId)) {
      this.logger.warn('Mock device not connected', { deviceId });
      return;
    }

    // Simulate disconnection delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Update device state
    device.isConnected = false;
    device.updatedAt = new Date();
    this.connectedDevices.delete(deviceId);

    // Stop button press simulation
    this.stopButtonPressSimulation();

    this.logger.info('Mock device disconnected successfully', { deviceId });

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
  }

  /**
   * Set button image on a mock device (simulated)
   */
  async setButtonImage(deviceId: string, buttonIndex: number, imagePath: string): Promise<void> {
    this.logger.info('Setting button image on mock device', {
      deviceId,
      buttonIndex,
      imagePath,
    });

    const device = this.mockDevices.find(d => d.id === deviceId);
    if (!device) {
      throw new Error(`Mock device ${deviceId} not found`);
    }

    if (!this.connectedDevices.has(deviceId)) {
      throw new Error(`Mock device ${deviceId} is not connected`);
    }

    if (buttonIndex < 0 || buttonIndex >= device.buttonCount) {
      throw new Error(`Button index ${buttonIndex} is out of range for mock device ${deviceId}`);
    }

    // Simulate image setting delay
    await new Promise(resolve => setTimeout(resolve, 200));

    this.logger.info('Mock button image set successfully', {
      deviceId,
      buttonIndex,
    });
  }

  /**
   * Set up button press event listener
   */
  onButtonPress(callback: (event: ButtonPressEvent) => void): void {
    this.on('buttonPress', callback);
  }

  /**
   * Get all connected mock devices
   */
  getConnectedDevices(): Device[] {
    return this.mockDevices.filter(device => device.isConnected);
  }

  /**
   * Get mock device by ID
   */
  getDevice(deviceId: string): Device | undefined {
    return this.mockDevices.find(device => device.id === deviceId);
  }

  /**
   * Check if mock device is connected
   */
  isDeviceConnected(deviceId: string): boolean {
    return this.connectedDevices.has(deviceId);
  }

  /**
   * Shutdown mock service
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down mock StreamDeck service');

    // Stop button press simulation
    this.stopButtonPressSimulation();

    // Disconnect all devices
    const disconnectPromises = Array.from(this.connectedDevices).map(deviceId =>
      this.disconnectDevice(deviceId).catch(error =>
        this.logger.error('Error disconnecting mock device during shutdown', error, { deviceId })
      )
    );

    await Promise.all(disconnectPromises);
    
    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('Mock StreamDeck service shutdown completed');
  }

  /**
   * Start simulating button presses
   */
  private startButtonPressSimulation(deviceId: string): void {
    if (this.buttonPressSimulator) {
      return; // Already running
    }

    this.logger.info('Starting button press simulation', { deviceId });

    let buttonPressCount = 0;
    this.buttonPressSimulator = setInterval(() => {
      const device = this.mockDevices.find(d => d.id === deviceId);
      if (!device || !this.connectedDevices.has(deviceId)) {
        this.stopButtonPressSimulation();
        return;
      }

      // Simulate random button press
      const buttonIndex = Math.floor(Math.random() * device.buttonCount);
      const pressTypes: ('short' | 'long' | 'double')[] = ['short', 'long', 'double'];
      const pressType = pressTypes[Math.floor(Math.random() * pressTypes.length)];

      this.logger.debug('Simulating button press', {
        deviceId,
        buttonIndex,
        pressType,
      });

      const buttonPressEvent = createEvent<ButtonPressEvent>(
        EventType.BUTTON_PRESS,
        {
          deviceId,
          buttonIndex,
          pressType,
          duration: pressType === 'long' ? 1000 : pressType === 'double' ? 200 : 100,
        }
      );

      this.emit('buttonPress', buttonPressEvent);
      buttonPressCount++;

      // Stop after 10 simulated presses
      if (buttonPressCount >= 10) {
        this.stopButtonPressSimulation();
      }
    }, 3000); // Simulate button press every 3 seconds
  }

  /**
   * Stop button press simulation
   */
  private stopButtonPressSimulation(): void {
    if (this.buttonPressSimulator) {
      clearInterval(this.buttonPressSimulator);
      this.buttonPressSimulator = undefined;
      this.logger.info('Button press simulation stopped');
    }
  }

  /**
   * Simulate a device error
   */
  simulateDeviceError(deviceId: string, errorMessage: string = 'Simulated device error'): void {
    this.logger.warn('Simulating device error', { deviceId, errorMessage });

    const device = this.getDevice(deviceId);
    const errorEvent = createEvent<DeviceErrorEvent>(
      EventType.DEVICE_ERROR,
      {
        deviceId,
        device,
        error: {
          code: 'MOCK_ERROR',
          message: errorMessage,
          details: { simulated: true },
        },
      }
    );

    this.emit('deviceError', errorEvent);
  }

  /**
   * Simulate unexpected device disconnection
   */
  simulateUnexpectedDisconnection(deviceId: string): void {
    this.logger.warn('Simulating unexpected disconnection', { deviceId });

    const device = this.mockDevices.find(d => d.id === deviceId);
    if (!device || !this.connectedDevices.has(deviceId)) {
      return;
    }

    // Update device state
    device.isConnected = false;
    device.updatedAt = new Date();
    this.connectedDevices.delete(deviceId);

    // Stop button press simulation
    this.stopButtonPressSimulation();

    // Emit disconnection event
    const disconnectionEvent = createEvent<DeviceDisconnectedEvent>(
      EventType.DEVICE_DISCONNECTED,
      {
        deviceId,
        device,
        reason: 'cable-unplugged',
      }
    );
    this.emit('deviceDisconnected', disconnectionEvent);
  }
}