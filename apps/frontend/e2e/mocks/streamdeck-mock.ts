import { Page, Route } from '@playwright/test';
import { DeviceResponse, ButtonResponse } from '../../src/types/api';
import {
  mockDevices,
  mockButtons,
  createMockDevice,
  createMockButton,
} from '../fixtures/test-data';

export class StreamDeckMockService {
  private devices: DeviceResponse[] = [...mockDevices];
  private buttons: Map<string, ButtonResponse[]> = new Map();
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    // Initialize buttons for each device
    this.devices.forEach((device) => {
      this.buttons.set(
        device.id,
        mockButtons.filter((b) => b.deviceId === device.id)
      );
    });
  }

  async setupMocks() {
    // Mock devices API
    await this.page.route('**/api/devices', async (route) => {
      await this.handleDevicesRoute(route);
    });

    await this.page.route(
      'http://localhost:3003/api/devices',
      async (route) => {
        await this.handleDevicesRoute(route);
      }
    );

    // Mock individual device API
    await this.page.route('**/api/devices/*', async (route) => {
      await this.handleDeviceRoute(route);
    });

    // Mock buttons API
    await this.page.route('**/api/devices/*/buttons', async (route) => {
      await this.handleButtonsRoute(route);
    });

    // Mock individual button API
    await this.page.route('**/api/devices/*/buttons/*', async (route) => {
      await this.handleButtonRoute(route);
    });

    // Mock button press API
    await this.page.route('**/api/devices/*/buttons/*/press', async (route) => {
      await this.handleButtonPressRoute(route);
    });

    // Mock device connection API
    await this.page.route('**/api/devices/*/connect', async (route) => {
      await this.handleDeviceConnectionRoute(route);
    });

    // Mock device disconnection API
    await this.page.route('**/api/devices/*/disconnect', async (route) => {
      await this.handleDeviceDisconnectionRoute(route);
    });

    // Mock health check API
    await this.page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: 3600,
            services: {
              database: 'healthy',
              streamdeck: 'healthy',
            },
          },
        }),
      });
    });

    // Mock WebSocket connection
    await this.page.addInitScript(() => {
      // Mock Socket.IO client
      (window as any).io = () => ({
        on: (event: string, callback: Function) => {
          // Store callbacks for later use
          (window as any).socketCallbacks =
            (window as any).socketCallbacks || {};
          (window as any).socketCallbacks[event] = callback;
        },
        emit: (event: string, data: any) => {
          console.log('Socket emit:', event, data);
        },
        disconnect: () => {
          console.log('Socket disconnected');
        },
      });
    });
  }

  private async handleDevicesRoute(route: Route) {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: this.devices,
        }),
      });
    } else {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Method not allowed',
        }),
      });
    }
  }

  private async handleDeviceRoute(route: Route) {
    const url = route.request().url();
    const deviceId = url.split('/devices/')[1].split('/')[0].split('?')[0];
    const method = route.request().method();

    const device = this.devices.find((d) => d.id === deviceId);

    if (!device) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Device not found',
        }),
      });
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: device,
        }),
      });
    } else if (method === 'PUT') {
      const requestBody = await route.request().postDataJSON();
      Object.assign(device, requestBody, {
        updatedAt: new Date().toISOString(),
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: device,
        }),
      });
    } else {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Method not allowed',
        }),
      });
    }
  }

  private async handleButtonsRoute(route: Route) {
    const url = route.request().url();
    const deviceId = url.split('/devices/')[1].split('/buttons')[0];
    const method = route.request().method();

    if (method === 'GET') {
      const deviceButtons = this.buttons.get(deviceId) || [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: deviceButtons,
        }),
      });
    } else {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Method not allowed',
        }),
      });
    }
  }

  private async handleButtonRoute(route: Route) {
    const url = route.request().url();
    const parts = url.split('/');
    const deviceId = parts[parts.indexOf('devices') + 1];
    const buttonPosition = parseInt(parts[parts.indexOf('buttons') + 1]);
    const method = route.request().method();

    const deviceButtons = this.buttons.get(deviceId) || [];
    const buttonIndex = deviceButtons.findIndex(
      (b) => b.position === buttonPosition
    );

    if (method === 'GET') {
      if (buttonIndex === -1) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Button not found',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: deviceButtons[buttonIndex],
        }),
      });
    } else if (method === 'PUT') {
      const requestBody = await route.request().postDataJSON();

      if (buttonIndex === -1) {
        // Create new button
        const newButton = createMockButton({
          deviceId,
          position: buttonPosition,
          ...requestBody,
        });
        deviceButtons.push(newButton);
        this.buttons.set(deviceId, deviceButtons);

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: newButton,
          }),
        });
      } else {
        // Update existing button
        Object.assign(deviceButtons[buttonIndex], requestBody, {
          updatedAt: new Date().toISOString(),
        });

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: deviceButtons[buttonIndex],
          }),
        });
      }
    } else if (method === 'DELETE') {
      if (buttonIndex === -1) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Button not found',
          }),
        });
        return;
      }

      deviceButtons.splice(buttonIndex, 1);
      this.buttons.set(deviceId, deviceButtons);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { deleted: true },
        }),
      });
    } else {
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Method not allowed',
        }),
      });
    }
  }

  private async handleButtonPressRoute(route: Route) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          executed: true,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  }

  private async handleDeviceConnectionRoute(route: Route) {
    const url = route.request().url();
    const deviceId = url.split('/devices/')[1].split('/connect')[0];

    const device = this.devices.find((d) => d.id === deviceId);
    if (!device) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Device not found',
        }),
      });
      return;
    }

    device.connected = true;
    device.updatedAt = new Date().toISOString();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: device,
      }),
    });
  }

  private async handleDeviceDisconnectionRoute(route: Route) {
    const url = route.request().url();
    const deviceId = url.split('/devices/')[1].split('/disconnect')[0];

    const device = this.devices.find((d) => d.id === deviceId);
    if (!device) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Device not found',
        }),
      });
      return;
    }

    device.connected = false;
    device.updatedAt = new Date().toISOString();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: device,
      }),
    });
  }

  // Helper methods for test scenarios
  addDevice(device: Partial<DeviceResponse> = {}) {
    const newDevice = createMockDevice(device);
    this.devices.push(newDevice);
    this.buttons.set(newDevice.id, []);
    return newDevice;
  }

  removeDevice(deviceId: string) {
    this.devices = this.devices.filter((d) => d.id !== deviceId);
    this.buttons.delete(deviceId);
  }

  connectDevice(deviceId: string) {
    const device = this.devices.find((d) => d.id === deviceId);
    if (device) {
      device.connected = true;
      device.updatedAt = new Date().toISOString();
    }
  }

  disconnectDevice(deviceId: string) {
    const device = this.devices.find((d) => d.id === deviceId);
    if (device) {
      device.connected = false;
      device.updatedAt = new Date().toISOString();
    }
  }

  addButton(deviceId: string, button: Partial<ButtonResponse> = {}) {
    const deviceButtons = this.buttons.get(deviceId) || [];
    const newButton = createMockButton({ deviceId, ...button });
    deviceButtons.push(newButton);
    this.buttons.set(deviceId, deviceButtons);
    return newButton;
  }

  removeButton(deviceId: string, buttonId: string) {
    const deviceButtons = this.buttons.get(deviceId) || [];
    const filteredButtons = deviceButtons.filter((b) => b.id !== buttonId);
    this.buttons.set(deviceId, filteredButtons);
  }

  simulateDeviceEvent(
    eventType: 'device-connected' | 'device-disconnected',
    deviceId: string
  ) {
    // Trigger WebSocket event simulation
    this.page.evaluate(
      (data) => {
        const callbacks = (window as any).socketCallbacks;
        if (callbacks && callbacks['device-event']) {
          callbacks['device-event'](data);
        }
      },
      {
        type: eventType,
        deviceId,
        timestamp: new Date().toISOString(),
      }
    );
  }

  simulateButtonPress(deviceId: string, buttonPosition: number) {
    // Trigger WebSocket event simulation
    this.page.evaluate(
      (data) => {
        const callbacks = (window as any).socketCallbacks;
        if (callbacks && callbacks['button-event']) {
          callbacks['button-event'](data);
        }
      },
      {
        type: 'button-pressed',
        deviceId,
        buttonPosition,
        timestamp: new Date().toISOString(),
      }
    );
  }
}
