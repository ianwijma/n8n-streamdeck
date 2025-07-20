import { StreamDeckService } from '../../../services/streamDeckService';
import { DeviceType } from '@n8n-streamdeck/shared';
import { MockStreamDeck } from '../../mocks/streamdeck.mock';

describe('StreamDeckService', () => {
  let service: StreamDeckService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers(); // Use real timers for this test suite

    // Clear cache to ensure fresh state
    const { cacheService } = require('../../../services/cacheService');
    cacheService.clear();

    service = new StreamDeckService({ autoConnect: false });
  });

  afterEach(() => {
    service.removeAllListeners();
    jest.useFakeTimers(); // Restore fake timers after each test
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultService = new StreamDeckService();
      expect(defaultService).toBeInstanceOf(StreamDeckService);
    });

    it('should initialize with custom options', () => {
      const customService = new StreamDeckService({
        autoConnect: false,
        reconnectInterval: 10000,
        maxReconnectAttempts: 5,
      });
      expect(customService).toBeInstanceOf(StreamDeckService);
    });
  });

  describe('discoverDevices', () => {
    it('should discover available StreamDeck devices', async () => {
      const devices = await service.discoverDevices();

      expect(devices).toHaveLength(3);
      expect(devices[0]).toMatchObject({
        name: 'StreamDeck Original',
        type: DeviceType.STREAMDECK_ORIGINAL,
        serialNumber: 'SD001234567890',
        buttonCount: 15,
        isConnected: false,
      });
      expect(devices[1]).toMatchObject({
        name: 'StreamDeck Mini',
        type: DeviceType.STREAMDECK_MINI,
        serialNumber: 'SD001234567891',
        buttonCount: 6,
        isConnected: false,
      });
      expect(devices[2]).toMatchObject({
        name: 'StreamDeck XL',
        type: DeviceType.STREAMDECK_XL,
        serialNumber: 'CL49K2A03951',
        buttonCount: 32,
        isConnected: false,
      });
    });

    it('should handle discovery errors', async () => {
      const { listStreamDecks } = await import('@elgato-stream-deck/node');
      (listStreamDecks as jest.Mock).mockRejectedValueOnce(
        new Error('Discovery failed')
      );

      await expect(service.discoverDevices()).rejects.toThrow(
        'Failed to discover StreamDeck devices: Discovery failed'
      );
    });
  });

  describe('connectToDevice', () => {
    beforeEach(async () => {
      await service.discoverDevices();
    });

    it('should connect to a device successfully', async () => {
      const deviceId = 'streamdeck-SD001234567890';

      await service.connectToDevice(deviceId);

      expect(service.isDeviceConnected(deviceId)).toBe(true);
      const device = service.getDevice(deviceId);
      expect(device?.isConnected).toBe(true);
      expect(device?.firmwareVersion).toBe('1.0.3');
    });

    it('should handle connection to non-existent device', async () => {
      const deviceId = 'non-existent-device';

      await expect(service.connectToDevice(deviceId)).rejects.toThrow(
        'Device non-existent-device not found. Run discoverDevices() first.'
      );
    });

    it('should handle already connected device', async () => {
      const deviceId = 'streamdeck-SD001234567890';

      await service.connectToDevice(deviceId);

      // Try to connect again
      await service.connectToDevice(deviceId);

      expect(service.isDeviceConnected(deviceId)).toBe(true);
    });

    it('should emit deviceConnected event on successful connection', async () => {
      const deviceId = 'streamdeck-SD001234567890';
      const eventSpy = jest.fn();

      service.on('deviceConnected', eventSpy);
      await service.connectToDevice(deviceId);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'device-connected',
          device: expect.objectContaining({ id: deviceId }),
          isReconnection: false,
        })
      );
    });

    it('should handle connection errors', async () => {
      const { openStreamDeck } = await import('@elgato-stream-deck/node');
      (openStreamDeck as jest.Mock).mockRejectedValueOnce(
        new Error('Connection failed')
      );

      const deviceId = 'streamdeck-SD001234567890';

      await expect(service.connectToDevice(deviceId)).rejects.toThrow(
        'Connection failed'
      );
    });
  });

  describe('disconnectDevice', () => {
    beforeEach(async () => {
      await service.discoverDevices();
    });

    it('should disconnect a connected device', async () => {
      const deviceId = 'streamdeck-SD001234567890';

      await service.connectToDevice(deviceId);
      expect(service.isDeviceConnected(deviceId)).toBe(true);

      await service.disconnectDevice(deviceId);
      expect(service.isDeviceConnected(deviceId)).toBe(false);

      const device = service.getDevice(deviceId);
      expect(device?.isConnected).toBe(false);
    });

    it('should handle disconnection of non-connected device', async () => {
      const deviceId = 'streamdeck-SD001234567890';

      await service.disconnectDevice(deviceId);

      expect(service.isDeviceConnected(deviceId)).toBe(false);
    });

    it('should emit deviceDisconnected event on successful disconnection', async () => {
      const deviceId = 'streamdeck-SD001234567890';
      const eventSpy = jest.fn();

      await service.connectToDevice(deviceId);
      service.on('deviceDisconnected', eventSpy);
      await service.disconnectDevice(deviceId);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'device-disconnected',
          deviceId,
          reason: 'user-disconnect',
        })
      );
    });
  });

  describe('setButtonImage', () => {
    beforeEach(async () => {
      await service.discoverDevices();
    });

    it('should set button image on connected device', async () => {
      const deviceId = 'streamdeck-SD001234567890';
      const buttonIndex = 0;
      const imagePath = '/path/to/image.png';

      await service.connectToDevice(deviceId);

      // Mock fs.readFile
      const fs = require('fs');
      const mockImageBuffer = Buffer.from('mock-image-data');
      jest
        .spyOn(fs.promises, 'readFile')
        .mockResolvedValueOnce(mockImageBuffer);

      await service.setButtonImage(deviceId, buttonIndex, imagePath);

      expect(fs.promises.readFile).toHaveBeenCalledWith(imagePath);
    });

    it('should handle setting image on disconnected device', async () => {
      const deviceId = 'streamdeck-SD001234567890';
      const buttonIndex = 0;
      const imagePath = '/path/to/image.png';

      await expect(
        service.setButtonImage(deviceId, buttonIndex, imagePath)
      ).rejects.toThrow(`Device ${deviceId} is not connected`);
    });

    it('should handle invalid button index', async () => {
      const deviceId = 'streamdeck-SD001234567890';
      const buttonIndex = 999;
      const imagePath = '/path/to/image.png';

      await service.connectToDevice(deviceId);

      await expect(
        service.setButtonImage(deviceId, buttonIndex, imagePath)
      ).rejects.toThrow(
        `Button index ${buttonIndex} is out of range for device ${deviceId}`
      );
    });
  });

  describe('getConnectedDevices', () => {
    beforeEach(async () => {
      await service.discoverDevices();
    });

    it('should return empty array when no devices connected', () => {
      const connectedDevices = service.getConnectedDevices();
      expect(connectedDevices).toHaveLength(0);
    });

    it('should return connected devices only', async () => {
      const deviceId1 = 'streamdeck-SD001234567890';

      await service.connectToDevice(deviceId1);

      const connectedDevices = service.getConnectedDevices();
      expect(connectedDevices).toHaveLength(1);
      expect(connectedDevices[0].id).toBe(deviceId1);
    });
  });

  describe('getDevice', () => {
    beforeEach(async () => {
      await service.discoverDevices();
    });

    it('should return device by ID', () => {
      const deviceId = 'streamdeck-SD001234567890';
      const device = service.getDevice(deviceId);

      expect(device).toBeDefined();
      expect(device?.id).toBe(deviceId);
    });

    it('should return undefined for non-existent device', () => {
      const device = service.getDevice('non-existent-device');
      expect(device).toBeUndefined();
    });
  });

  describe('isDeviceConnected', () => {
    beforeEach(async () => {
      await service.discoverDevices();
    });

    it('should return true for connected device', async () => {
      const deviceId = 'streamdeck-SD001234567890';

      expect(service.isDeviceConnected(deviceId)).toBe(false);

      await service.connectToDevice(deviceId);
      expect(service.isDeviceConnected(deviceId)).toBe(true);
    });

    it('should return false for non-existent device', () => {
      expect(service.isDeviceConnected('non-existent-device')).toBe(false);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await service.discoverDevices();
    });

    it('should disconnect all devices and cleanup', async () => {
      const deviceId1 = 'streamdeck-SD001234567890';
      const deviceId2 = 'streamdeck-SD001234567891';

      await service.connectToDevice(deviceId1);
      await service.connectToDevice(deviceId2);

      expect(service.getConnectedDevices()).toHaveLength(2);

      await service.shutdown();

      expect(service.getConnectedDevices()).toHaveLength(0);
      expect(service.listenerCount('deviceConnected')).toBe(0);
      expect(service.listenerCount('deviceDisconnected')).toBe(0);
    });
  });

  describe('button press events', () => {
    beforeEach(async () => {
      await service.discoverDevices();
    });

    it('should emit button press events', async () => {
      const deviceId = 'streamdeck-SD001234567890';
      const buttonIndex = 0;
      const eventSpy = jest.fn();

      await service.connectToDevice(deviceId);
      service.on('buttonPress', eventSpy);

      // Get the mock device and simulate button press
      const connectedDevices = (service as any).connectedDevices;
      const mockDevice = connectedDevices.get(deviceId) as MockStreamDeck;
      mockDevice.simulateButtonPress(buttonIndex);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'button-press',
          deviceId,
          buttonIndex,
          pressType: 'short',
        })
      );
    });
  });

  describe('device error handling', () => {
    beforeEach(async () => {
      await service.discoverDevices();
    });

    it('should emit device error events', async () => {
      const deviceId = 'streamdeck-SD001234567890';
      const eventSpy = jest.fn();

      await service.connectToDevice(deviceId);
      service.on('deviceError', eventSpy);

      // Get the mock device and simulate error
      const connectedDevices = (service as any).connectedDevices;
      const mockDevice = connectedDevices.get(deviceId) as MockStreamDeck;
      const testError = new Error('Test error');
      mockDevice.simulateError(testError);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'device-error',
          deviceId,
          error: expect.objectContaining({
            code: 'DEVICE_ERROR',
            message: 'Test error',
          }),
        })
      );
    });
  });

  describe('device type mapping', () => {
    it('should map device models correctly', async () => {
      const devices = await service.discoverDevices();

      const originalDevice = devices.find(
        (d) => d.serialNumber === 'SD001234567890'
      );
      expect(originalDevice?.type).toBe(DeviceType.STREAMDECK_ORIGINAL);
      expect(originalDevice?.buttonCount).toBe(15);

      const miniDevice = devices.find(
        (d) => d.serialNumber === 'SD001234567891'
      );
      expect(miniDevice?.type).toBe(DeviceType.STREAMDECK_MINI);
      expect(miniDevice?.buttonCount).toBe(6);

      const xlDevice = devices.find((d) => d.serialNumber === 'CL49K2A03951');
      expect(xlDevice?.type).toBe(DeviceType.STREAMDECK_XL);
      expect(xlDevice?.buttonCount).toBe(32);
    });
  });
});
