import { Request, Response as ExpressResponse } from 'express';
import { Application } from 'express';
import request, { Response } from 'supertest';
import { createApp } from '../../app';
import { StreamDeckService } from '../../services/streamDeckService';
import {
  Device,
  DeviceType,
  Button,
  ButtonActionType,
  generateUUID,
} from '@n8n-streamdeck/shared';

// Test application instance
let testApp: Application;

export const getTestApp = (): Application => {
  if (!testApp) {
    testApp = createApp();
  }
  return testApp;
};

// Mock request and response objects
export const createMockRequest = (
  overrides: Partial<Request> = {}
): Partial<Request> => {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    requestId: generateUUID(),
    ...overrides,
  };
};

export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
};

// Mock devices for testing
export const createMockDevice = (overrides: Partial<Device> = {}): Device => {
  return {
    id: `device-${generateUUID()}`,
    name: 'Test StreamDeck',
    type: DeviceType.STREAMDECK_ORIGINAL,
    serialNumber: 'TEST123456789',
    buttonCount: 15,
    isConnected: false,
    firmwareVersion: '1.0.3',
    brightness: 75,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

// Mock buttons for testing
export const createMockButton = (
  deviceId: string,
  index: number,
  overrides: Partial<Button> = {}
): Button => {
  return {
    id: `button-${generateUUID()}`,
    deviceId,
    index,
    label: `Button ${index + 1}`,
    isEnabled: true,
    backgroundColor: '#000000',
    textColor: '#ffffff',
    fontSize: 12,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};

// Mock button with action
export const createMockButtonWithAction = (
  deviceId: string,
  index: number
): Button => {
  return createMockButton(deviceId, index, {
    label: 'Test Action Button',
    action: {
      type: ButtonActionType.TRIGGER_WORKFLOW,
      payload: { workflowId: 'test-workflow-123' },
      n8nWorkflowId: 'test-workflow-123',
    },
  });
};

// API test helpers
export class ApiTestHelper {
  private app: Application;

  constructor() {
    this.app = getTestApp();
  }

  // Device API helpers
  async getDevices(query: Record<string, string> = {}): Promise<Response> {
    const queryString = new URLSearchParams(query).toString();
    const url = `/api/devices${queryString ? `?${queryString}` : ''}`;
    return request(this.app).get(url);
  }

  async getDevice(deviceId: string) {
    return request(this.app).get(`/api/devices/${deviceId}`);
  }

  async connectDevice(deviceId: string) {
    return request(this.app).post(`/api/devices/${deviceId}/connect`);
  }

  async disconnectDevice(deviceId: string) {
    return request(this.app).delete(`/api/devices/${deviceId}`);
  }

  async getDeviceStatus(deviceId: string) {
    return request(this.app).get(`/api/devices/${deviceId}/status`);
  }

  async updateDeviceBrightness(deviceId: string, brightness: number) {
    return request(this.app)
      .put(`/api/devices/${deviceId}/brightness`)
      .send({ brightness });
  }

  // Button API helpers
  async getButtons(deviceId: string, query: Record<string, string> = {}) {
    const queryString = new URLSearchParams(query).toString();
    const url = `/api/devices/${deviceId}/buttons${queryString ? `?${queryString}` : ''}`;
    return request(this.app).get(url);
  }

  async createButton(deviceId: string, buttonData: any) {
    return request(this.app)
      .post(`/api/devices/${deviceId}/buttons`)
      .send(buttonData);
  }

  async getButton(deviceId: string, buttonId: string) {
    return request(this.app).get(
      `/api/devices/${deviceId}/buttons/${buttonId}`
    );
  }

  async deleteButton(deviceId: string, buttonId: string) {
    return request(this.app).delete(
      `/api/devices/${deviceId}/buttons/${buttonId}`
    );
  }

  async pressButton(deviceId: string, buttonId: string) {
    return request(this.app).post(
      `/api/devices/${deviceId}/buttons/${buttonId}/press`
    );
  }

  // Config API helpers
  async getConfig() {
    return request(this.app).get('/api/config');
  }

  async updateConfig(configData: any) {
    return request(this.app).put('/api/config').send(configData);
  }

  async getConfigSchema() {
    return request(this.app).get('/api/config/schema');
  }

  async validateConfig(configData: any) {
    return request(this.app).post('/api/config/validate').send(configData);
  }

  async resetConfig() {
    return request(this.app).post('/api/config/reset');
  }

  async getConfigHealth() {
    return request(this.app).get('/api/config/health');
  }

  // Health check helper
  async getHealth() {
    return request(this.app).get('/health');
  }
}

// Database/Storage test helpers
export class StorageTestHelper {
  private static instance: StorageTestHelper;
  private mockData: Map<string, any> = new Map();

  static getInstance(): StorageTestHelper {
    if (!StorageTestHelper.instance) {
      StorageTestHelper.instance = new StorageTestHelper();
    }
    return StorageTestHelper.instance;
  }

  // Mock storage operations
  set(key: string, value: any): void {
    this.mockData.set(key, JSON.parse(JSON.stringify(value)));
  }

  get<T>(key: string): T | undefined {
    const value = this.mockData.get(key);
    return value ? JSON.parse(JSON.stringify(value)) : undefined;
  }

  has(key: string): boolean {
    return this.mockData.has(key);
  }

  delete(key: string): boolean {
    return this.mockData.delete(key);
  }

  clear(): void {
    this.mockData.clear();
  }

  // Device storage helpers
  setDevice(device: Device): void {
    this.set(`device:${device.id}`, device);
  }

  getDevice(deviceId: string): Device | undefined {
    return this.get<Device>(`device:${deviceId}`);
  }

  setDevices(devices: Device[]): void {
    devices.forEach((device) => this.setDevice(device));
  }

  getDevices(): Device[] {
    const devices: Device[] = [];
    for (const [key, value] of this.mockData.entries()) {
      if (key.startsWith('device:')) {
        devices.push(value);
      }
    }
    return devices;
  }

  // Button storage helpers
  setButton(button: Button): void {
    this.set(`button:${button.deviceId}:${button.id}`, button);
  }

  getButton(deviceId: string, buttonId: string): Button | undefined {
    return this.get<Button>(`button:${deviceId}:${buttonId}`);
  }

  setButtons(deviceId: string, buttons: Button[]): void {
    // Ensure buttons belong to the correct device
    buttons.forEach((button) => {
      if (button.deviceId !== deviceId) {
        button.deviceId = deviceId;
      }
      this.setButton(button);
    });
  }

  getButtons(deviceId: string): Button[] {
    const buttons: Button[] = [];
    for (const [key, value] of this.mockData.entries()) {
      if (key.startsWith(`button:${deviceId}:`)) {
        buttons.push(value);
      }
    }
    return buttons.sort((a, b) => a.index - b.index);
  }
}

// StreamDeck service test helper
export class StreamDeckTestHelper {
  private service: StreamDeckService;

  constructor() {
    this.service = new StreamDeckService({ autoConnect: false });
  }

  getService(): StreamDeckService {
    return this.service;
  }

  async setupMockDevices(devices: Device[] = []): Promise<void> {
    const mockDevices =
      devices.length > 0
        ? devices
        : [
            createMockDevice({ id: 'test-device-1', name: 'Test Device 1' }),
            createMockDevice({
              id: 'test-device-2',
              name: 'Test Device 2',
              type: DeviceType.STREAMDECK_MINI,
            }),
          ];

    // Store devices in the service's internal map
    const deviceMap = (this.service as any).deviceInfo;
    mockDevices.forEach((device) => {
      deviceMap.set(device.id, device);
    });
  }

  async simulateDeviceConnection(deviceId: string): Promise<void> {
    const device = this.service.getDevice(deviceId);
    if (device) {
      device.isConnected = true;
      device.updatedAt = new Date();
    }
  }

  async simulateDeviceDisconnection(deviceId: string): Promise<void> {
    const device = this.service.getDevice(deviceId);
    if (device) {
      device.isConnected = false;
      device.updatedAt = new Date();
    }
  }

  async simulateButtonPress(
    deviceId: string,
    buttonIndex: number
  ): Promise<void> {
    // Emit button press event
    this.service.emit('buttonPress', {
      type: 'button-press',
      timestamp: new Date().toISOString(),
      data: {
        deviceId,
        buttonIndex,
        pressType: 'short',
        duration: 100,
      },
    });
  }

  cleanup(): void {
    this.service.removeAllListeners();
  }
}

// Test assertion helpers
export const expectSuccessResponse = (response: any, expectedData?: any) => {
  expect(response.body).toHaveProperty('success', true);
  expect(response.body).toHaveProperty('timestamp');
  expect(response.body).toHaveProperty('requestId');

  if (expectedData) {
    expect(response.body.data).toEqual(expect.objectContaining(expectedData));
  }
};

export const expectErrorResponse = (
  response: any,
  expectedCode?: string,
  expectedMessage?: string
) => {
  expect(response.body).toHaveProperty('success', false);
  expect(response.body).toHaveProperty('error');
  expect(response.body).toHaveProperty('timestamp');
  expect(response.body).toHaveProperty('requestId');

  if (expectedCode) {
    expect(response.body.error.code).toBe(expectedCode);
  }

  if (expectedMessage) {
    expect(response.body.error.message).toContain(expectedMessage);
  }
};

export const expectPaginatedResponse = (
  response: any,
  expectedTotal?: number
) => {
  expectSuccessResponse(response);
  expect(response.body).toHaveProperty('pagination');
  expect(response.body.pagination).toHaveProperty('page');
  expect(response.body.pagination).toHaveProperty('limit');
  expect(response.body.pagination).toHaveProperty('total');
  expect(response.body.pagination).toHaveProperty('totalPages');
  expect(response.body.pagination).toHaveProperty('hasNext');
  expect(response.body.pagination).toHaveProperty('hasPrev');

  if (expectedTotal !== undefined) {
    expect(response.body.pagination.total).toBe(expectedTotal);
  }
};
