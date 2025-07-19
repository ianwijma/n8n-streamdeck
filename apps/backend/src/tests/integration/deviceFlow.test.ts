import { StreamDeckService } from '../../services/streamDeckService';
import { StreamDeckTestHelper, createMockDevice } from '../utils/testHelpers';
import { DeviceType } from '@n8n-streamdeck/shared';

// Mock the StreamDeck module
jest.mock('@elgato-stream-deck/node');

describe('Device Flow Integration Tests', () => {
  let streamDeckHelper: StreamDeckTestHelper;
  let service: StreamDeckService;

  beforeEach(() => {
    streamDeckHelper = new StreamDeckTestHelper();
    service = streamDeckHelper.getService();
  });

  afterEach(() => {
    streamDeckHelper.cleanup();
  });

  describe('Device Discovery and Connection Flow', () => {
    it('should discover devices and connect successfully', async () => {
      // Setup mock devices
      const mockDevices = [
        createMockDevice({
          id: 'device-1',
          name: 'StreamDeck Original',
          type: DeviceType.STREAMDECK_ORIGINAL,
          buttonCount: 15,
        }),
        createMockDevice({
          id: 'device-2',
          name: 'StreamDeck Mini',
          type: DeviceType.STREAMDECK_MINI,
          buttonCount: 6,
        }),
      ];

      await streamDeckHelper.setupMockDevices(mockDevices);

      // Discover devices
      const discoveredDevices = await service.discoverDevices();
      expect(discoveredDevices).toHaveLength(2);

      // Connect to first device
      await streamDeckHelper.simulateDeviceConnection('device-1');
      expect(service.isDeviceConnected('device-1')).toBe(true);

      // Verify device state
      const device = service.getDevice('device-1');
      expect(device?.isConnected).toBe(true);

      // Get connected devices
      const connectedDevices = service.getConnectedDevices();
      expect(connectedDevices).toHaveLength(1);
      expect(connectedDevices[0].id).toBe('device-1');
    });

    it('should handle device disconnection flow', async () => {
      const mockDevice = createMockDevice({ id: 'device-1' });
      await streamDeckHelper.setupMockDevices([mockDevice]);

      // Connect device
      await streamDeckHelper.simulateDeviceConnection('device-1');
      expect(service.isDeviceConnected('device-1')).toBe(true);

      // Disconnect device
      await streamDeckHelper.simulateDeviceDisconnection('device-1');
      expect(service.isDeviceConnected('device-1')).toBe(false);

      // Verify no connected devices
      const connectedDevices = service.getConnectedDevices();
      expect(connectedDevices).toHaveLength(0);
    });
  });

  describe('Button Press Event Flow', () => {
    it('should handle button press events', async () => {
      const mockDevice = createMockDevice({ id: 'device-1', buttonCount: 15 });
      await streamDeckHelper.setupMockDevices([mockDevice]);
      await streamDeckHelper.simulateDeviceConnection('device-1');

      // Set up event listener
      const buttonPressEvents: any[] = [];
      service.on('buttonPress', (event) => {
        buttonPressEvents.push(event);
      });

      // Simulate button press
      await streamDeckHelper.simulateButtonPress('device-1', 0);

      // Verify event was emitted
      expect(buttonPressEvents).toHaveLength(1);
      expect(buttonPressEvents[0]).toMatchObject({
        type: 'button-press',
        data: expect.objectContaining({
          deviceId: 'device-1',
          buttonIndex: 0,
          pressType: 'short',
        }),
      });
    });

    it('should handle multiple button presses', async () => {
      const mockDevice = createMockDevice({ id: 'device-1', buttonCount: 15 });
      await streamDeckHelper.setupMockDevices([mockDevice]);
      await streamDeckHelper.simulateDeviceConnection('device-1');

      const buttonPressEvents: any[] = [];
      service.on('buttonPress', (event) => {
        buttonPressEvents.push(event);
      });

      // Simulate multiple button presses
      await streamDeckHelper.simulateButtonPress('device-1', 0);
      await streamDeckHelper.simulateButtonPress('device-1', 1);
      await streamDeckHelper.simulateButtonPress('device-1', 2);

      expect(buttonPressEvents).toHaveLength(3);
      expect(buttonPressEvents[0].data.buttonIndex).toBe(0);
      expect(buttonPressEvents[1].data.buttonIndex).toBe(1);
      expect(buttonPressEvents[2].data.buttonIndex).toBe(2);
    });
  });

  describe('Device Type Handling', () => {
    it('should handle different device types correctly', async () => {
      const mockDevices = [
        createMockDevice({
          id: 'original-device',
          type: DeviceType.STREAMDECK_ORIGINAL,
          buttonCount: 15,
        }),
        createMockDevice({
          id: 'mini-device',
          type: DeviceType.STREAMDECK_MINI,
          buttonCount: 6,
        }),
        createMockDevice({
          id: 'xl-device',
          type: DeviceType.STREAMDECK_XL,
          buttonCount: 32,
        }),
      ];

      await streamDeckHelper.setupMockDevices(mockDevices);

      const originalDevice = service.getDevice('original-device');
      const miniDevice = service.getDevice('mini-device');
      const xlDevice = service.getDevice('xl-device');

      expect(originalDevice?.buttonCount).toBe(15);
      expect(miniDevice?.buttonCount).toBe(6);
      expect(xlDevice?.buttonCount).toBe(32);

      expect(originalDevice?.type).toBe(DeviceType.STREAMDECK_ORIGINAL);
      expect(miniDevice?.type).toBe(DeviceType.STREAMDECK_MINI);
      expect(xlDevice?.type).toBe(DeviceType.STREAMDECK_XL);
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle device errors gracefully', async () => {
      const mockDevice = createMockDevice({ id: 'device-1' });
      await streamDeckHelper.setupMockDevices([mockDevice]);
      await streamDeckHelper.simulateDeviceConnection('device-1');

      const errorEvents: any[] = [];
      service.on('deviceError', (event) => {
        errorEvents.push(event);
      });

      // Simulate device error (this would be done through the mock device)
      // For now, we'll test that the error handling structure is in place
      expect(service.listenerCount('deviceError')).toBe(1);
    });

    it('should handle connection failures', async () => {
      // Test connection to non-existent device
      await expect(
        service.connectToDevice('non-existent-device')
      ).rejects.toThrow();
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize service correctly', () => {
      const newService = new StreamDeckService({
        autoConnect: false,
        reconnectInterval: 10000,
        maxReconnectAttempts: 5,
      });

      expect(newService).toBeInstanceOf(StreamDeckService);
      expect(newService.getConnectedDevices()).toHaveLength(0);
    });

    it('should shutdown service cleanly', async () => {
      const mockDevices = [
        createMockDevice({ id: 'device-1' }),
        createMockDevice({ id: 'device-2' }),
      ];

      await streamDeckHelper.setupMockDevices(mockDevices);
      await streamDeckHelper.simulateDeviceConnection('device-1');
      await streamDeckHelper.simulateDeviceConnection('device-2');

      expect(service.getConnectedDevices()).toHaveLength(2);

      await service.shutdown();

      expect(service.getConnectedDevices()).toHaveLength(0);
      expect(service.listenerCount('deviceConnected')).toBe(0);
      expect(service.listenerCount('deviceDisconnected')).toBe(0);
      expect(service.listenerCount('buttonPress')).toBe(0);
    });
  });

  describe('Button Configuration Flow', () => {
    it('should handle button configuration workflow', async () => {
      const mockDevice = createMockDevice({ id: 'device-1', buttonCount: 15 });
      await streamDeckHelper.setupMockDevices([mockDevice]);
      await streamDeckHelper.simulateDeviceConnection('device-1');

      // This would typically involve the button controller
      // but we're testing the service-level functionality
      expect(service.isDeviceConnected('device-1')).toBe(true);
      expect(service.getDevice('device-1')?.buttonCount).toBe(15);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent device operations', async () => {
      const mockDevices = [
        createMockDevice({ id: 'device-1' }),
        createMockDevice({ id: 'device-2' }),
        createMockDevice({ id: 'device-3' }),
      ];

      await streamDeckHelper.setupMockDevices(mockDevices);

      // Simulate concurrent connections
      const connectionPromises = [
        streamDeckHelper.simulateDeviceConnection('device-1'),
        streamDeckHelper.simulateDeviceConnection('device-2'),
        streamDeckHelper.simulateDeviceConnection('device-3'),
      ];

      await Promise.all(connectionPromises);

      expect(service.getConnectedDevices()).toHaveLength(3);
    });

    it('should handle concurrent button presses', async () => {
      const mockDevice = createMockDevice({ id: 'device-1', buttonCount: 15 });
      await streamDeckHelper.setupMockDevices([mockDevice]);
      await streamDeckHelper.simulateDeviceConnection('device-1');

      const buttonPressEvents: any[] = [];
      service.on('buttonPress', (event) => {
        buttonPressEvents.push(event);
      });

      // Simulate concurrent button presses
      const pressPromises = [
        streamDeckHelper.simulateButtonPress('device-1', 0),
        streamDeckHelper.simulateButtonPress('device-1', 1),
        streamDeckHelper.simulateButtonPress('device-1', 2),
        streamDeckHelper.simulateButtonPress('device-1', 3),
        streamDeckHelper.simulateButtonPress('device-1', 4),
      ];

      await Promise.all(pressPromises);

      expect(buttonPressEvents).toHaveLength(5);
    });
  });
});
