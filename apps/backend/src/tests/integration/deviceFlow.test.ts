import request from 'supertest';
import { Server } from 'http';
import { createApp } from '../../app';
import { StreamDeckService } from '../../services/streamDeckService';
import { Device, DeviceType } from '@n8n-streamdeck/shared';

describe('Device Discovery and Connection Flow Integration', () => {
  let app: any;
  let server: Server;
  let streamDeckService: StreamDeckService;

  // Helper function to create proper Device objects
  const createMockDevice = (overrides: Partial<Device> = {}): Device => {
    const now = new Date();
    return {
      id: 'test-device-1',
      name: 'StreamDeck MK.2',
      type: DeviceType.STREAMDECK_MK2,
      serialNumber: 'CL12345678',
      buttonCount: 15,
      isConnected: true,
      firmwareVersion: '1.0.0',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

  beforeAll(async () => {
    // Create app with test configuration
    app = createApp();
    server = app.listen(0); // Use random port
    streamDeckService = StreamDeckService.getInstance();
  });

  afterAll(async () => {
    await streamDeckService.cleanup();
    server.close();
  });

  beforeEach(async () => {
    // Reset service state before each test
    await streamDeckService.cleanup();
    streamDeckService = StreamDeckService.getInstance();
  });

  describe('Device Discovery', () => {
    it('should discover connected StreamDeck devices', async () => {
      // Create proper mock device using helper function
      const mockDevice = createMockDevice({
        id: 'test-device-1',
        name: 'StreamDeck MK.2',
        serialNumber: 'CL12345678',
        isConnected: true,
        buttonCount: 15,
        firmwareVersion: '1.0.0',
      });

      // Simulate device connection
      streamDeckService.addMockDevice(mockDevice);

      const response = await request(app).get('/api/devices').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: mockDevice.id,
        name: mockDevice.name,
        type: mockDevice.type,
        isConnected: true,
      });
    });

    it('should handle device connection events', async () => {
      const mockDevice = createMockDevice({
        id: 'test-device-2',
        name: 'StreamDeck Mini',
        type: DeviceType.STREAMDECK_MINI,
        serialNumber: 'CL87654321',
        isConnected: false,
        buttonCount: 6,
        firmwareVersion: '1.0.0',
      });

      // Initially no devices
      let response = await request(app).get('/api/devices').expect(200);

      expect(response.body.data).toHaveLength(0);

      // Simulate device connection
      streamDeckService.addMockDevice({ ...mockDevice, isConnected: true });

      // Device should now be available
      response = await request(app).get('/api/devices').expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isConnected).toBe(true);
    });

    it('should handle device disconnection events', async () => {
      const mockDevice = createMockDevice({
        id: 'test-device-3',
        name: 'StreamDeck XL',
        type: DeviceType.STREAMDECK_XL,
        serialNumber: 'CL11111111',
        isConnected: true,
        buttonCount: 32,
        firmwareVersion: '1.0.0',
      });

      // Add connected device
      streamDeckService.addMockDevice(mockDevice);

      let response = await request(app).get('/api/devices').expect(200);

      expect(response.body.data[0].isConnected).toBe(true);

      // Simulate disconnection
      streamDeckService.updateMockDevice(mockDevice.id, { isConnected: false });

      response = await request(app).get('/api/devices').expect(200);

      expect(response.body.data[0].isConnected).toBe(false);
    });
  });

  describe('Device Connection Management', () => {
    it('should connect to a specific device', async () => {
      const mockDevice = createMockDevice({
        id: 'test-device-4',
        name: 'StreamDeck MK.2',
        serialNumber: 'CL22222222',
        isConnected: false,
        buttonCount: 15,
        firmwareVersion: '1.0.0',
      });

      streamDeckService.addMockDevice(mockDevice);

      const response = await request(app)
        .post(`/api/devices/${mockDevice.id}/connect`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isConnected).toBe(true);
    });

    it('should disconnect from a specific device', async () => {
      const mockDevice = createMockDevice({
        id: 'test-device-5',
        name: 'StreamDeck MK.2',
        serialNumber: 'CL33333333',
        isConnected: true,
        buttonCount: 15,
        firmwareVersion: '1.0.0',
      });

      streamDeckService.addMockDevice(mockDevice);

      const response = await request(app)
        .post(`/api/devices/${mockDevice.id}/disconnect`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isConnected).toBe(false);
    });

    it('should handle connection errors gracefully', async () => {
      const response = await request(app)
        .post('/api/devices/non-existent-device/connect')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Device not found');
    });
  });

  describe('Device Information Retrieval', () => {
    it('should get detailed device information', async () => {
      const mockDevice = createMockDevice({
        id: 'test-device-6',
        name: 'StreamDeck MK.2',
        serialNumber: 'CL44444444',
        isConnected: true,
        buttonCount: 15,
        firmwareVersion: '1.0.0',
      });

      streamDeckService.addMockDevice(mockDevice);

      const response = await request(app)
        .get(`/api/devices/${mockDevice.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: mockDevice.id,
        name: mockDevice.name,
        type: mockDevice.type,
        serialNumber: mockDevice.serialNumber,
        isConnected: mockDevice.isConnected,
        buttonCount: mockDevice.buttonCount,
        firmwareVersion: mockDevice.firmwareVersion,
      });
    });

    it('should return 404 for non-existent device', async () => {
      const response = await request(app)
        .get('/api/devices/non-existent-device')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Device not found');
    });
  });

  describe('Multiple Device Management', () => {
    it('should handle multiple connected devices', async () => {
      const devices = [
        createMockDevice({
          id: 'device-1',
          name: 'StreamDeck MK.2',
          type: DeviceType.STREAMDECK_MK2,
          serialNumber: 'CL11111111',
          isConnected: true,
          buttonCount: 15,
          firmwareVersion: '1.0.0',
        }),
        createMockDevice({
          id: 'device-2',
          name: 'StreamDeck Mini',
          type: DeviceType.STREAMDECK_MINI,
          serialNumber: 'CL22222222',
          isConnected: true,
          buttonCount: 6,
          firmwareVersion: '1.0.0',
        }),
        createMockDevice({
          id: 'device-3',
          name: 'StreamDeck XL',
          type: DeviceType.STREAMDECK_XL,
          serialNumber: 'CL33333333',
          isConnected: false,
          buttonCount: 32,
          firmwareVersion: '1.0.0',
        }),
      ];

      devices.forEach((device) => {
        streamDeckService.addMockDevice(device);
      });

      const response = await request(app).get('/api/devices').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);

      const connectedDevices = response.body.data.filter(
        (d: any) => d.isConnected
      );
      expect(connectedDevices).toHaveLength(2);
    });

    it('should maintain device state independently', async () => {
      const device1 = createMockDevice({
        id: 'device-1',
        name: 'StreamDeck MK.2',
        serialNumber: 'CL11111111',
        isConnected: true,
        buttonCount: 15,
        firmwareVersion: '1.0.0',
      });

      const device2 = createMockDevice({
        id: 'device-2',
        name: 'StreamDeck Mini',
        type: DeviceType.STREAMDECK_MINI,
        serialNumber: 'CL22222222',
        isConnected: true,
        buttonCount: 6,
        firmwareVersion: '1.0.0',
      });

      streamDeckService.addMockDevice(device1);
      streamDeckService.addMockDevice(device2);

      // Disconnect device1
      await request(app)
        .post(`/api/devices/${device1.id}/disconnect`)
        .expect(200);

      // Check that device2 is still connected
      const response = await request(app)
        .get(`/api/devices/${device2.id}`)
        .expect(200);

      expect(response.body.data.isConnected).toBe(true);

      // Check that device1 is disconnected
      const response2 = await request(app)
        .get(`/api/devices/${device1.id}`)
        .expect(200);

      expect(response2.body.data.isConnected).toBe(false);
    });
  });
});
