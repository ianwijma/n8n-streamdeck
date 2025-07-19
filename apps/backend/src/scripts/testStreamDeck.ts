#!/usr/bin/env tsx

import { StreamDeckService } from '../services/streamDeckService';
import { MockStreamDeckService } from '../services/mockStreamDeckService';
import { 
  ButtonPressEvent, 
  DeviceConnectedEvent, 
  DeviceDisconnectedEvent, 
  DeviceErrorEvent,
  Logger 
} from '@n8n-streamdeck/shared';

import { LogLevel } from '@n8n-streamdeck/shared';

const logger = new Logger({ level: LogLevel.DEBUG }, 'StreamDeckTest');

async function testStreamDeckService(): Promise<void> {
  logger.info('Starting StreamDeck service test');

  // Check if we should use mock service
  const useMock = process.argv.includes('--mock') || process.env.USE_MOCK_STREAMDECK === 'true';
  
  // Create StreamDeck service instance
  const streamDeckService = useMock 
    ? new MockStreamDeckService()
    : new StreamDeckService({
        autoConnect: false, // Manual connection for testing
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
      });

  logger.info(`Using ${useMock ? 'Mock' : 'Real'} StreamDeck service`);

  // Set up event listeners
  streamDeckService.onButtonPress((event: ButtonPressEvent) => {
    logger.info('Button press event received', {
      deviceId: event.deviceId,
      buttonIndex: event.buttonIndex,
      pressType: event.pressType,
      timestamp: event.timestamp,
    });
  });

  streamDeckService.on('deviceConnected', (event: DeviceConnectedEvent) => {
    logger.info('Device connected event received', {
      deviceId: event.device.id,
      deviceName: event.device.name,
      deviceType: event.device.type,
      buttonCount: event.device.buttonCount,
      isReconnection: event.isReconnection,
    });
  });

  streamDeckService.on('deviceDisconnected', (event: DeviceDisconnectedEvent) => {
    logger.warn('Device disconnected event received', {
      deviceId: event.deviceId,
      reason: event.reason,
      deviceName: event.device?.name,
    });
  });

  streamDeckService.on('deviceError', (event: DeviceErrorEvent) => {
    logger.error('Device error event received', new Error(event.error.message), {
      deviceId: event.deviceId,
      errorCode: event.error.code,
      deviceName: event.device?.name,
    });
  });

  try {
    // Step 1: Discover devices
    logger.info('Step 1: Discovering StreamDeck devices...');
    const devices = await streamDeckService.discoverDevices();
    
    if (devices.length === 0) {
      logger.warn('No StreamDeck devices found.');
      if (!useMock) {
        logger.info('Consider running with --mock flag to test with mock devices');
        return;
      }
    }

    logger.info(`Found ${devices.length} StreamDeck device(s):`);
    devices.forEach((device, index) => {
      logger.info(`  ${index + 1}. ${device.name} (${device.type})`, {
        id: device.id,
        serialNumber: device.serialNumber,
        buttonCount: device.buttonCount,
        isConnected: device.isConnected,
      });
    });

    // Step 2: Connect to the first device
    const firstDevice = devices[0];
    logger.info(`Step 2: Connecting to device: ${firstDevice.name}`);
    
    await streamDeckService.connectToDevice(firstDevice.id);
    logger.info('Device connected successfully');

    // Step 3: Test device status
    const isConnected = streamDeckService.isDeviceConnected(firstDevice.id);
    logger.info(`Device connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);

    const connectedDevices = streamDeckService.getConnectedDevices();
    logger.info(`Total connected devices: ${connectedDevices.length}`);

    // Step 4: Wait for button presses
    logger.info('Step 3: Waiting for button presses... (Press any button on the StreamDeck)');
    logger.info('Press Ctrl+C to stop the test');

    // Keep the process alive to listen for button presses
    await new Promise<void>((resolve) => {
      let buttonPressCount = 0;
      const maxButtonPresses = 5;

      streamDeckService.onButtonPress((event) => {
        buttonPressCount++;
        logger.info(`Button press ${buttonPressCount}/${maxButtonPresses} detected!`, {
          buttonIndex: event.buttonIndex,
          pressType: event.pressType,
        });

        if (buttonPressCount >= maxButtonPresses) {
          logger.info('Maximum button presses reached, ending test');
          resolve();
        }
      });

      // Auto-resolve after 30 seconds if no button presses
      setTimeout(() => {
        logger.info('Test timeout reached (30 seconds), ending test');
        resolve();
      }, 30000);
    });

    // Step 5: Test image setting (if we have a test image)
    try {
      logger.info('Step 4: Testing button image setting...');
      // Note: This would require an actual image file
      // await streamDeckService.setButtonImage(firstDevice.id, 0, '/path/to/test/image.png');
      logger.info('Button image test skipped (no test image available)');
    } catch (error) {
      logger.warn('Button image test failed', { error: (error as Error).message });
    }

    // Step 6: Disconnect device
    logger.info('Step 5: Disconnecting device...');
    await streamDeckService.disconnectDevice(firstDevice.id);
    logger.info('Device disconnected successfully');

  } catch (error) {
    logger.error('StreamDeck test failed', error as Error);
  } finally {
    // Cleanup
    logger.info('Cleaning up...');
    await streamDeckService.shutdown();
    logger.info('StreamDeck service test completed');
  }
}

async function testMockScenario(streamDeckService: StreamDeckService): Promise<void> {
  logger.info('Running mock scenario for testing without physical device');

  // Simulate some test scenarios
  logger.info('Mock: Simulating device discovery failure...');
  try {
    await streamDeckService.discoverDevices();
  } catch (error) {
    logger.info('Mock: Device discovery failed as expected', { error: (error as Error).message });
  }

  logger.info('Mock: Simulating connection to non-existent device...');
  try {
    await streamDeckService.connectToDevice('mock-device-123');
  } catch (error) {
    logger.info('Mock: Connection failed as expected', { error: (error as Error).message });
  }

  logger.info('Mock: Testing service status methods...');
  const connectedDevices = streamDeckService.getConnectedDevices();
  logger.info(`Mock: Connected devices count: ${connectedDevices.length}`);

  const isConnected = streamDeckService.isDeviceConnected('mock-device-123');
  logger.info(`Mock: Device connection status: ${isConnected}`);

  const device = streamDeckService.getDevice('mock-device-123');
  logger.info(`Mock: Device info: ${device ? 'Found' : 'Not found'}`);

  logger.info('Mock scenario completed');
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the test
if (require.main === module) {
  testStreamDeckService().catch((error) => {
    logger.error('Test script failed', error);
    process.exit(1);
  });
}