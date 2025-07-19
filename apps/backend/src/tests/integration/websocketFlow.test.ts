import { Server } from 'http';
import { createApp } from '../../app';
import { StreamDeckService } from '../../services/streamDeckService';
import { Device, DeviceType, EventType } from '@n8n-streamdeck/shared';
import { io as Client, Socket } from 'socket.io-client';

describe('WebSocket Real-time Communication Integration', () => {
  let app: any;
  let server: Server;
  let streamDeckService: StreamDeckService;
  let clientSocket: Socket;
  let serverPort: number;

  // Helper function to create proper Device objects
  const createMockDevice = (overrides: Partial<Device> = {}): Device => {
    const now = new Date();
    return {
      id: 'websocket-test-device',
      name: 'StreamDeck MK.2',
      type: DeviceType.STREAMDECK_MK2,
      serialNumber: 'WS12345678',
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
    serverPort = (server.address() as any).port;
    streamDeckService = StreamDeckService.getInstance();

    // Wait for server to be ready
    await new Promise<void>((resolve) => {
      server.on('listening', resolve);
    });
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    await streamDeckService.cleanup();
    server.close();
  });

  beforeEach(async () => {
    // Reset service state before each test
    await streamDeckService.cleanup();
    streamDeckService = StreamDeckService.getInstance();

    // Create fresh client socket for each test
    if (clientSocket) {
      clientSocket.disconnect();
    }
    clientSocket = Client(`http://localhost:${serverPort}`);

    // Wait for connection
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  describe('Device Connection Events', () => {
    it('should broadcast device connected event to all clients', (done) => {
      const mockDevice = createMockDevice();

      // Listen for device connected event
      clientSocket.on('device:connected', (data) => {
        expect(data.type).toBe(EventType.DEVICE_CONNECTED);
        expect(data.device.id).toBe(mockDevice.id);
        expect(data.device.isConnected).toBe(true);
        done();
      });

      // Simulate device connection
      streamDeckService.addMockDevice(mockDevice);
    });

    it('should broadcast device disconnected event to all clients', (done) => {
      const mockDevice = createMockDevice({ isConnected: true });
      streamDeckService.addMockDevice(mockDevice);

      // Listen for device disconnected event
      clientSocket.on('device:disconnected', (data) => {
        expect(data.type).toBe(EventType.DEVICE_DISCONNECTED);
        expect(data.deviceId).toBe(mockDevice.id);
        expect(data.reason).toBe('user-disconnect');
        done();
      });

      // Simulate device disconnection
      setTimeout(() => {
        streamDeckService.updateMockDevice(mockDevice.id, {
          isConnected: false,
        });
      }, 100);
    });

    it('should broadcast device error events to all clients', (done) => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      // Listen for device error event
      clientSocket.on('device:error', (data) => {
        expect(data.type).toBe(EventType.DEVICE_ERROR);
        expect(data.deviceId).toBe(mockDevice.id);
        expect(data.error.code).toBe('DEVICE_ERROR');
        expect(data.error.message).toBe('Test error');
        done();
      });

      // Simulate device error
      setTimeout(() => {
        // Emit error event directly from service
        const errorEvent = {
          id: 'test-error-id',
          timestamp: new Date(),
          type: EventType.DEVICE_ERROR,
          source: 'device' as const,
          deviceId: mockDevice.id,
          device: mockDevice,
          error: {
            code: 'DEVICE_ERROR',
            message: 'Test error',
          },
        };
        streamDeckService.emit('deviceError', errorEvent);
      }, 100);
    });
  });

  describe('Button Press Events', () => {
    it('should broadcast button press events to all clients', (done) => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      const buttonIndex = 5;

      // Listen for button press event
      clientSocket.on('button:pressed', (data) => {
        expect(data.type).toBe(EventType.BUTTON_PRESS);
        expect(data.deviceId).toBe(mockDevice.id);
        expect(data.buttonIndex).toBe(buttonIndex);
        expect(data.pressType).toBe('short');
        done();
      });

      // Simulate button press
      setTimeout(() => {
        const buttonPressEvent = {
          id: 'test-button-press-id',
          timestamp: new Date(),
          type: EventType.BUTTON_PRESS,
          source: 'device' as const,
          deviceId: mockDevice.id,
          buttonIndex,
          pressType: 'short' as const,
          duration: 100,
        };
        streamDeckService.emit('buttonPress', buttonPressEvent);
      }, 100);
    });

    it('should handle different press types (short, long, double)', (done) => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      const buttonIndex = 3;
      let eventCount = 0;
      const expectedEvents = ['short', 'long', 'double'];

      // Listen for button press events
      clientSocket.on('button:pressed', (data) => {
        expect(data.pressType).toBe(expectedEvents[eventCount]);
        eventCount++;

        if (eventCount === expectedEvents.length) {
          done();
        }
      });

      // Simulate different press types
      setTimeout(() => {
        expectedEvents.forEach((pressType, index) => {
          setTimeout(() => {
            const buttonPressEvent = {
              id: `test-button-press-${index}`,
              timestamp: new Date(),
              type: EventType.BUTTON_PRESS,
              source: 'device' as const,
              deviceId: mockDevice.id,
              buttonIndex,
              pressType: pressType as 'short' | 'long' | 'double',
              duration: pressType === 'long' ? 1000 : 100,
            };
            streamDeckService.emit('buttonPress', buttonPressEvent);
          }, index * 50);
        });
      }, 100);
    });
  });

  describe('Client-to-Server Communication', () => {
    it('should handle device list requests from clients', (done) => {
      const mockDevices = [
        createMockDevice({ id: 'device-1', name: 'Device 1' }),
        createMockDevice({
          id: 'device-2',
          name: 'Device 2',
          isConnected: false,
        }),
      ];

      mockDevices.forEach((device) => streamDeckService.addMockDevice(device));

      // Request device list
      clientSocket.emit('devices:list', (response: any) => {
        expect(response.success).toBe(true);
        expect(response.data).toHaveLength(2);
        expect(response.data[0].name).toBe('Device 1');
        expect(response.data[1].name).toBe('Device 2');
        done();
      });
    });

    it('should handle device connection requests from clients', (done) => {
      const mockDevice = createMockDevice({ isConnected: false });
      streamDeckService.addMockDevice(mockDevice);

      // Listen for device connected event
      clientSocket.on('device:connected', (data) => {
        expect(data.device.id).toBe(mockDevice.id);
        expect(data.device.isConnected).toBe(true);
        done();
      });

      // Request device connection
      clientSocket.emit(
        'device:connect',
        { deviceId: mockDevice.id },
        (response: any) => {
          expect(response.success).toBe(true);
        }
      );
    });

    it('should handle button press simulation from clients', (done) => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      const buttonIndex = 7;

      // Listen for button press event
      clientSocket.on('button:pressed', (data) => {
        expect(data.deviceId).toBe(mockDevice.id);
        expect(data.buttonIndex).toBe(buttonIndex);
        expect(data.pressType).toBe('short');
        done();
      });

      // Simulate button press from client
      clientSocket.emit(
        'button:press',
        {
          deviceId: mockDevice.id,
          buttonIndex,
          pressType: 'short',
        },
        (response: any) => {
          expect(response.success).toBe(true);
        }
      );
    });
  });

  describe('Room-based Communication', () => {
    it('should support device-specific rooms for targeted events', (done) => {
      const device1 = createMockDevice({ id: 'device-1' });
      const device2 = createMockDevice({ id: 'device-2' });

      streamDeckService.addMockDevice(device1);
      streamDeckService.addMockDevice(device2);

      let eventCount = 0;

      // Join device-specific room
      clientSocket.emit('room:join', { deviceId: device1.id });

      // Listen for device-specific events
      clientSocket.on('device:status', (data) => {
        // Should only receive events for device-1
        expect(data.deviceId).toBe(device1.id);
        eventCount++;

        if (eventCount === 1) {
          done();
        }
      });

      // Emit events for both devices
      setTimeout(() => {
        // This should be received (device-1)
        clientSocket.emit('device:status', {
          deviceId: device1.id,
          status: 'active',
        });

        // This should NOT be received (device-2)
        setTimeout(() => {
          clientSocket.emit('device:status', {
            deviceId: device2.id,
            status: 'active',
          });
        }, 50);
      }, 100);
    });

    it('should handle room leave operations', (done) => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      let eventReceived = false;

      // Join room first
      clientSocket.emit('room:join', { deviceId: mockDevice.id });

      // Leave room
      setTimeout(() => {
        clientSocket.emit('room:leave', { deviceId: mockDevice.id });

        // Try to send event after leaving
        setTimeout(() => {
          clientSocket.emit('device:status', {
            deviceId: mockDevice.id,
            status: 'test',
          });

          // Wait to ensure no event is received
          setTimeout(() => {
            expect(eventReceived).toBe(false);
            done();
          }, 200);
        }, 100);
      }, 100);

      // This should not be called after leaving the room
      clientSocket.on('device:status', () => {
        eventReceived = true;
      });
    });
  });

  describe('Connection Management', () => {
    it('should handle client disconnection gracefully', (done) => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      // Simulate client disconnect
      clientSocket.disconnect();

      // Verify server handles disconnection without errors
      setTimeout(() => {
        // Try to emit event after client disconnect
        const buttonPressEvent = {
          id: 'test-after-disconnect',
          timestamp: new Date(),
          type: EventType.BUTTON_PRESS,
          source: 'device' as const,
          deviceId: mockDevice.id,
          buttonIndex: 0,
          pressType: 'short' as const,
          duration: 100,
        };

        // This should not cause any errors
        streamDeckService.emit('buttonPress', buttonPressEvent);
        done();
      }, 100);
    });

    it('should handle multiple client connections', (done) => {
      const mockDevice = createMockDevice();
      streamDeckService.addMockDevice(mockDevice);

      // Create second client
      const client2 = Client(`http://localhost:${serverPort}`);
      let client1Received = false;
      let client2Received = false;

      client2.on('connect', () => {
        // Both clients listen for the same event
        clientSocket.on('device:connected', () => {
          client1Received = true;
          checkBothReceived();
        });

        client2.on('device:connected', () => {
          client2Received = true;
          checkBothReceived();
        });

        // Trigger event
        streamDeckService.updateMockDevice(mockDevice.id, {
          isConnected: false,
        });
        setTimeout(() => {
          streamDeckService.updateMockDevice(mockDevice.id, {
            isConnected: true,
          });
        }, 100);
      });

      function checkBothReceived() {
        if (client1Received && client2Received) {
          client2.disconnect();
          done();
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event data gracefully', (done) => {
      // Send invalid data
      clientSocket.emit(
        'device:connect',
        { invalidData: true },
        (response: any) => {
          expect(response.success).toBe(false);
          expect(response.error).toContain('Invalid');
          done();
        }
      );
    });

    it('should handle non-existent device operations', (done) => {
      clientSocket.emit(
        'device:connect',
        { deviceId: 'non-existent' },
        (response: any) => {
          expect(response.success).toBe(false);
          expect(response.error).toContain('not found');
          done();
        }
      );
    });

    it('should handle malformed button press requests', (done) => {
      clientSocket.emit(
        'button:press',
        {
          deviceId: 'test-device',
          // Missing buttonIndex
          pressType: 'short',
        },
        (response: any) => {
          expect(response.success).toBe(false);
          expect(response.error).toContain('buttonIndex');
          done();
        }
      );
    });
  });
});
