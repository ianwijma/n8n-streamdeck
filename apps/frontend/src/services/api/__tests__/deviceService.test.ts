import { deviceService } from '../deviceService';
import apiClient from '../../../utils/apiClient';
import { mockDevice, mockApiResponses } from '../../../tests/mocks';

// Mock the API client
jest.mock('../../../utils/apiClient');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('DeviceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDevices', () => {
    it('should fetch all devices', async () => {
      mockedApiClient.get.mockResolvedValue(
        mockApiResponses.devices.getAll.data
      );

      const result = await deviceService.getDevices();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/devices');
      expect(result).toEqual(mockApiResponses.devices.getAll.data);
    });

    it('should handle API errors', async () => {
      const error = new Error('Network error');
      mockedApiClient.get.mockRejectedValue(error);

      await expect(deviceService.getDevices()).rejects.toThrow('Network error');
    });
  });

  describe('getDevice', () => {
    it('should fetch device by ID', async () => {
      mockedApiClient.get.mockResolvedValue(mockDevice);

      const result = await deviceService.getDevice('test-device-1');

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        '/api/devices/test-device-1'
      );
      expect(result).toEqual(mockDevice);
    });
  });

  describe('connectDevice', () => {
    it('should connect a device', async () => {
      const connectedDevice = { ...mockDevice, connected: true };
      mockedApiClient.post.mockResolvedValue(connectedDevice);

      const result = await deviceService.connectDevice('test-device-1');

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/api/devices/test-device-1/connect'
      );
      expect(result).toEqual(connectedDevice);
    });
  });

  describe('disconnectDevice', () => {
    it('should disconnect a device', async () => {
      const disconnectedDevice = { ...mockDevice, connected: false };
      mockedApiClient.post.mockResolvedValue(disconnectedDevice);

      const result = await deviceService.disconnectDevice('test-device-1');

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/api/devices/test-device-1/disconnect'
      );
      expect(result).toEqual(disconnectedDevice);
    });
  });

  describe('updateDevice', () => {
    it('should update device with new data', async () => {
      const updateData = { name: 'Updated Device Name' };
      const updatedDevice = { ...mockDevice, name: 'Updated Device Name' };
      mockedApiClient.put.mockResolvedValue(updatedDevice);

      const result = await deviceService.updateDevice(
        'test-device-1',
        updateData
      );

      expect(mockedApiClient.put).toHaveBeenCalledWith(
        '/api/devices/test-device-1',
        updateData
      );
      expect(result).toEqual(updatedDevice);
    });
  });

  describe('deleteDevice', () => {
    it('should delete a device', async () => {
      mockedApiClient.delete.mockResolvedValue(undefined);

      await deviceService.deleteDevice('test-device-1');

      expect(mockedApiClient.delete).toHaveBeenCalledWith(
        '/api/devices/test-device-1'
      );
    });
  });

  describe('scanDevices', () => {
    it('should scan for new devices', async () => {
      const scannedDevices = [mockDevice];
      mockedApiClient.post.mockResolvedValue(scannedDevices);

      const result = await deviceService.scanDevices();

      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/devices/scan');
      expect(result).toEqual(scannedDevices);
    });
  });
});
