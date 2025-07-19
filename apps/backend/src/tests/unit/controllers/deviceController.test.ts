import { DeviceController } from '../../../controllers/deviceController';
import { StreamDeckService } from '../../../services/streamDeckService';
import {
  createMockRequest,
  createMockResponse,
  createMockDevice,
} from '../../utils/testHelpers';
import { HttpStatusCode, ApiErrorCode } from '@n8n-streamdeck/shared';

// Mock the StreamDeck module
jest.mock('@elgato-stream-deck/node');

describe('DeviceController', () => {
  let controller: DeviceController;
  let mockStreamDeckService: jest.Mocked<StreamDeckService>;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    // Create mock service
    mockStreamDeckService = {
      discoverDevices: jest.fn(),
      connectToDevice: jest.fn(),
      disconnectDevice: jest.fn(),
      getDevice: jest.fn(),
      isDeviceConnected: jest.fn(),
      getConnectedDevices: jest.fn(),
      setButtonImage: jest.fn(),
      shutdown: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;

    controller = new DeviceController(mockStreamDeckService);
    mockRequest = createMockRequest();
    mockResponse = createMockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listDevices', () => {
    it('should return paginated list of devices', async () => {
      const mockDevices = [
        createMockDevice({ id: 'device-1', name: 'Device 1' }),
        createMockDevice({ id: 'device-2', name: 'Device 2' }),
      ];

      mockStreamDeckService.discoverDevices.mockResolvedValue(mockDevices);
      (mockStreamDeckService as any).deviceInfo = new Map([
        ['device-1', mockDevices[0]],
        ['device-2', mockDevices[1]],
      ]);

      mockRequest.query = { page: '1', limit: '10' };

      await controller.listDevices(mockRequest, mockResponse);

      expect(mockStreamDeckService.discoverDevices).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ id: 'device-1' }),
            expect.objectContaining({ id: 'device-2' }),
          ]),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          }),
        })
      );
    });

    it('should filter disconnected devices when requested', async () => {
      const mockDevices = [
        createMockDevice({ id: 'device-1', isConnected: true }),
        createMockDevice({ id: 'device-2', isConnected: false }),
      ];

      mockStreamDeckService.discoverDevices.mockResolvedValue(mockDevices);
      (mockStreamDeckService as any).deviceInfo = new Map([
        ['device-1', mockDevices[0]],
        ['device-2', mockDevices[1]],
      ]);

      mockRequest.query = { includeDisconnected: 'false' };

      await controller.listDevices(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ id: 'device-1', isConnected: true }),
          ]),
        })
      );
    });

    it('should handle discovery errors', async () => {
      mockStreamDeckService.discoverDevices.mockRejectedValue(
        new Error('Discovery failed')
      );

      await controller.listDevices(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.INTERNAL_ERROR,
            message: 'Failed to retrieve devices',
          }),
        })
      );
    });
  });

  describe('getDevice', () => {
    it('should return device by ID', async () => {
      const mockDevice = createMockDevice({ id: 'device-1' });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockRequest.params = { id: 'device-1' };

      await controller.getDevice(mockRequest, mockResponse);

      expect(mockStreamDeckService.getDevice).toHaveBeenCalledWith('device-1');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'device-1' }),
        })
      );
    });

    it('should return 404 for non-existent device', async () => {
      mockStreamDeckService.getDevice.mockReturnValue(undefined);
      mockRequest.params = { id: 'non-existent' };

      await controller.getDevice(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.NOT_FOUND
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.NOT_FOUND,
            message: "Device with ID 'non-existent' not found",
          }),
        })
      );
    });

    it('should return 400 for missing device ID', async () => {
      mockRequest.params = {};

      await controller.getDevice(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Device ID is required',
          }),
        })
      );
    });
  });

  describe('connectDevice', () => {
    it('should connect to device successfully', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: false,
      });
      const connectedDevice = { ...mockDevice, isConnected: true };

      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockStreamDeckService.isDeviceConnected.mockReturnValue(false);
      mockStreamDeckService.connectToDevice.mockResolvedValue(undefined);
      mockStreamDeckService.getDevice
        .mockReturnValueOnce(mockDevice)
        .mockReturnValueOnce(connectedDevice);

      mockRequest.params = { id: 'device-1' };

      await controller.connectDevice(mockRequest, mockResponse);

      expect(mockStreamDeckService.connectToDevice).toHaveBeenCalledWith(
        'device-1'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'device-1', isConnected: true }),
        })
      );
    });

    it('should return 404 for non-existent device', async () => {
      mockStreamDeckService.getDevice.mockReturnValue(undefined);
      mockRequest.params = { id: 'non-existent' };

      await controller.connectDevice(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.NOT_FOUND
      );
    });

    it('should return 409 for already connected device', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: true,
      });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockStreamDeckService.isDeviceConnected.mockReturnValue(true);
      mockRequest.params = { id: 'device-1' };

      await controller.connectDevice(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.CONFLICT,
            message: 'Device is already connected',
          }),
        })
      );
    });

    it('should handle connection errors', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: false,
      });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockStreamDeckService.isDeviceConnected.mockReturnValue(false);
      mockStreamDeckService.connectToDevice.mockRejectedValue(
        new Error('Connection failed')
      );
      mockRequest.params = { id: 'device-1' };

      await controller.connectDevice(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.DEVICE_NOT_CONNECTED,
            message: 'Failed to connect to device',
          }),
        })
      );
    });
  });

  describe('disconnectDevice', () => {
    it('should disconnect device successfully', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: true,
      });
      const disconnectedDevice = { ...mockDevice, isConnected: false };

      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockStreamDeckService.isDeviceConnected.mockReturnValue(true);
      mockStreamDeckService.disconnectDevice.mockResolvedValue(undefined);
      mockStreamDeckService.getDevice
        .mockReturnValueOnce(mockDevice)
        .mockReturnValueOnce(disconnectedDevice);

      mockRequest.params = { id: 'device-1' };

      await controller.disconnectDevice(mockRequest, mockResponse);

      expect(mockStreamDeckService.disconnectDevice).toHaveBeenCalledWith(
        'device-1'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'device-1', isConnected: false }),
        })
      );
    });

    it('should return 409 for already disconnected device', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: false,
      });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockStreamDeckService.isDeviceConnected.mockReturnValue(false);
      mockRequest.params = { id: 'device-1' };

      await controller.disconnectDevice(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.CONFLICT,
            message: 'Device is already disconnected',
          }),
        })
      );
    });
  });

  describe('getDeviceStatus', () => {
    it('should return device status', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: true,
        brightness: 80,
        firmwareVersion: '1.0.3',
      });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockRequest.params = { id: 'device-1' };

      await controller.getDeviceStatus(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            deviceId: 'device-1',
            status: 'connected',
            brightness: 80,
            firmwareVersion: '1.0.3',
            buttonCount: 15,
          }),
        })
      );
    });

    it('should return disconnected status for disconnected device', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: false,
      });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockRequest.params = { id: 'device-1' };

      await controller.getDeviceStatus(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'disconnected',
          }),
        })
      );
    });
  });

  describe('updateBrightness', () => {
    it('should update device brightness successfully', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: true,
        brightness: 50,
      });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockStreamDeckService.isDeviceConnected.mockReturnValue(true);
      mockRequest.params = { id: 'device-1' };
      mockRequest.body = { brightness: 80 };

      await controller.updateBrightness(mockRequest, mockResponse);

      expect(mockDevice.brightness).toBe(80);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ brightness: 80 }),
        })
      );
    });

    it('should return 400 for invalid brightness value', async () => {
      mockRequest.params = { id: 'device-1' };
      mockRequest.body = { brightness: 150 };

      await controller.updateBrightness(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Brightness must be a number between 0 and 100',
          }),
        })
      );
    });

    it('should return 400 for disconnected device', async () => {
      const mockDevice = createMockDevice({
        id: 'device-1',
        isConnected: false,
      });
      mockStreamDeckService.getDevice.mockReturnValue(mockDevice);
      mockStreamDeckService.isDeviceConnected.mockReturnValue(false);
      mockRequest.params = { id: 'device-1' };
      mockRequest.body = { brightness: 80 };

      await controller.updateBrightness(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatusCode.BAD_REQUEST
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ApiErrorCode.DEVICE_NOT_CONNECTED,
            message: 'Cannot update brightness of disconnected device',
          }),
        })
      );
    });
  });
});
