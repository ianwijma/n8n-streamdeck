import request from 'supertest';
import { Server } from 'http';
import { createApp } from '../../app';
import { StreamDeckService } from '../../services/streamDeckService';
import {
  Device,
  DeviceType,
  Button,
  ButtonAction,
} from '@n8n-streamdeck/shared';

describe('Webhook and Button Press Integration', () => {
  let app: any;
  let server: Server;
  let streamDeckService: StreamDeckService;

  // Helper function to create proper Device objects
  const createMockDevice = (overrides: Partial<Device> = {}): Device => {
    const now = new Date();
    return {
      id: 'webhook-test-device',
      name: 'StreamDeck MK.2',
      type: DeviceType.STREAMDECK_MK2,
      serialNumber: 'WH12345678',
      buttonCount: 15,
      isConnected: true,
      firmwareVersion: '1.0.0',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

  // Helper function to create proper Button objects
  const createMockButton = (overrides: Partial<Button> = {}): Button => {
    const now = new Date();
    return {
      id: 'webhook-test-button',
      deviceId: 'webhook-test-device',
      index: 0,
      label: 'Test Button',
      isEnabled: true,
      action: {
        type: 'webhook',
        url: 'http://localhost:3001/webhook/test',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        payload: { message: 'Button pressed' },
      } as ButtonAction,
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

  describe('Button Configuration and Webhook Integration', () => {
    it('should create button with webhook action', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      const buttonData = {
        index: 0,
        label: 'Webhook Test',
        action: {
          type: 'webhook',
          url: 'http://localhost:3001/webhook/test',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          payload: { message: 'Button pressed' },
        },
      };

      const response = await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .send(buttonData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action.type).toBe('webhook');
      expect(response.body.data.action.url).toBe(buttonData.action.url);
    });

    it('should create button with workflow trigger action', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      const buttonData = {
        index: 1,
        label: 'Workflow Test',
        action: {
          type: 'workflow-trigger',
          workflowId: 'test-workflow-123',
          payload: { source: 'streamdeck' },
        },
      };

      const response = await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .send(buttonData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action.type).toBe('workflow-trigger');
      expect(response.body.data.action.workflowId).toBe(
        buttonData.action.workflowId
      );
    });

    it('should create button with hotkey action', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      const buttonData = {
        index: 2,
        label: 'Hotkey Test',
        action: {
          type: 'hotkey',
          keys: ['ctrl', 'shift', 's'],
          modifiers: ['ctrl', 'shift'],
        },
      };

      const response = await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .send(buttonData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action.type).toBe('hotkey');
      expect(response.body.data.action.keys).toEqual(buttonData.action.keys);
    });

    it('should create button with command action', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      const buttonData = {
        index: 3,
        label: 'Command Test',
        action: {
          type: 'command',
          command: 'echo "Hello World"',
          workingDirectory: '/tmp',
          environment: { NODE_ENV: 'test' },
        },
      };

      const response = await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .send(buttonData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action.type).toBe('command');
      expect(response.body.data.action.command).toBe(buttonData.action.command);
    });
  });

  describe('Button Press Simulation and Event Handling', () => {
    it('should simulate button press and trigger webhook', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      // First create a button with webhook action
      const buttonData = {
        index: 0,
        label: 'Webhook Test',
        action: {
          type: 'webhook',
          url: 'http://httpbin.org/post',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          payload: {
            message: 'Button pressed',
            timestamp: new Date().toISOString(),
          },
        },
      };

      await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .send(buttonData)
        .expect(200);

      // Then simulate button press
      const response = await request(app)
        .post(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}/press`)
        .send({ pressType: 'short' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.executed).toBe(true);
    });

    it('should handle button press for workflow trigger', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      // Create button with workflow trigger
      const buttonData = {
        index: 1,
        label: 'Workflow Test',
        action: {
          type: 'workflow-trigger',
          workflowId: 'test-workflow-123',
          payload: { source: 'streamdeck', deviceId: mockDevice.id },
        },
      };

      await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .send(buttonData)
        .expect(200);

      // Simulate button press
      const response = await request(app)
        .post(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}/press`)
        .send({ pressType: 'short' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.executed).toBe(true);
    });

    it('should handle disabled button press gracefully', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      // Create disabled button
      const buttonData = {
        index: 2,
        label: 'Disabled Button',
        isEnabled: false,
        action: {
          type: 'webhook',
          url: 'http://httpbin.org/post',
          method: 'POST',
        },
      };

      await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .send(buttonData)
        .expect(200);

      // Try to press disabled button
      const response = await request(app)
        .post(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}/press`)
        .send({ pressType: 'short' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('disabled');
    });
  });

  describe('Button Management Operations', () => {
    it('should list all buttons for a device', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      // Create multiple buttons
      const buttons = [
        {
          index: 0,
          label: 'Button 1',
          action: { type: 'webhook', url: 'http://test1.com' },
        },
        {
          index: 1,
          label: 'Button 2',
          action: { type: 'webhook', url: 'http://test2.com' },
        },
        {
          index: 2,
          label: 'Button 3',
          action: { type: 'workflow-trigger', workflowId: 'wf-123' },
        },
      ];

      for (const button of buttons) {
        await request(app)
          .put(`/api/devices/${mockDevice.id}/buttons/${button.index}`)
          .send(button)
          .expect(200);
      }

      // List all buttons
      const response = await request(app)
        .get(`/api/devices/${mockDevice.id}/buttons`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.map((b: any) => b.label)).toEqual([
        'Button 1',
        'Button 2',
        'Button 3',
      ]);
    });

    it('should get specific button by index', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      const buttonData = {
        index: 5,
        label: 'Specific Button',
        action: {
          type: 'hotkey',
          keys: ['f5'],
        },
      };

      await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .send(buttonData)
        .expect(200);

      // Get specific button
      const response = await request(app)
        .get(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.label).toBe(buttonData.label);
      expect(response.body.data.index).toBe(buttonData.index);
    });

    it('should delete/reset button to default', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      // Create button
      const buttonData = {
        index: 7,
        label: 'To Be Deleted',
        action: { type: 'webhook', url: 'http://delete-me.com' },
      };

      await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .send(buttonData)
        .expect(200);

      // Delete button
      const response = await request(app)
        .delete(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify button is reset to default
      const getResponse = await request(app)
        .get(`/api/devices/${mockDevice.id}/buttons/${buttonData.index}`)
        .expect(200);

      expect(getResponse.body.data.label).toBe('');
      expect(getResponse.body.data.action).toBeNull();
    });
  });

  describe('Error Handling and Validation', () => {
    it('should validate webhook URL format', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      const invalidButtonData = {
        index: 0,
        label: 'Invalid Webhook',
        action: {
          type: 'webhook',
          url: 'not-a-valid-url',
          method: 'POST',
        },
      };

      const response = await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${invalidButtonData.index}`)
        .send(invalidButtonData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid URL');
    });

    it('should validate workflow trigger has workflowId', async () => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      const invalidButtonData = {
        index: 1,
        label: 'Invalid Workflow',
        action: {
          type: 'workflow-trigger',
          // Missing workflowId
          payload: { test: true },
        },
      };

      const response = await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${invalidButtonData.index}`)
        .send(invalidButtonData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('workflowId');
    });

    it('should validate button index is within device range', async () => {
      const mockDevice = createMockDevice({ buttonCount: 15 });
      streamDeckService.addMockDevice(mockDevice);

      const invalidButtonData = {
        index: 20, // Out of range for 15-button device
        label: 'Out of Range',
        action: { type: 'webhook', url: 'http://test.com' },
      };

      const response = await request(app)
        .put(`/api/devices/${mockDevice.id}/buttons/${invalidButtonData.index}`)
        .send(invalidButtonData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('out of range');
    });

    it('should handle non-existent device gracefully', async () => {
      const response = await request(app)
        .put('/api/devices/non-existent-device/buttons/0')
        .send({
          index: 0,
          label: 'Test',
          action: { type: 'webhook', url: 'http://test.com' },
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Device not found');
    });
  });
});
