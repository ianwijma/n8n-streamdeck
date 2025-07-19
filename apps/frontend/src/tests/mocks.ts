import {
  DeviceResponse,
  ButtonResponse,
  AppConfigResponse,
  HealthCheckResponse,
} from '../types/api';

export const mockDevice: DeviceResponse = {
  id: 'test-device-1',
  name: 'Test StreamDeck',
  serialNumber: 'SD123456789',
  model: 'Stream Deck MK.2',
  firmwareVersion: '1.0.0',
  connected: true,
  buttonCount: 15,
  columns: 5,
  rows: 3,
  lastSeen: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockDisconnectedDevice: DeviceResponse = {
  ...mockDevice,
  id: 'test-device-2',
  name: 'Disconnected StreamDeck',
  connected: false,
};

export const mockButton: ButtonResponse = {
  id: 'test-button-1',
  deviceId: 'test-device-1',
  position: 0,
  title: 'Test Button',
  icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  backgroundColor: '#000000',
  textColor: '#ffffff',
  fontSize: 12,
  action: {
    type: 'webhook',
    config: {
      url: 'https://api.example.com/test',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"test": true}',
    } as any,
  },
  enabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockButtons: ButtonResponse[] = [
  mockButton,
  {
    ...mockButton,
    id: 'test-button-2',
    position: 1,
    title: 'Button 2',
    action: {
      type: 'webhook',
      config: {
        url: 'https://hooks.example.com/webhook',
        method: 'POST',
      } as any,
    },
  },
  {
    ...mockButton,
    id: 'test-button-3',
    position: 2,
    title: 'Button 3',
    enabled: false,
    action: {
      type: 'n8n-workflow',
      config: {
        workflowId: 'workflow-123',
        webhookUrl: 'https://n8n.example.com/webhook/workflow-123',
        payload: { input: 'test' },
      } as any,
    },
  },
];

export const mockApiResponses = {
  devices: {
    getAll: { success: true, data: [mockDevice, mockDisconnectedDevice] },
    getById: { success: true, data: mockDevice },
    create: { success: true, data: mockDevice },
    update: { success: true, data: mockDevice },
    delete: { success: true, data: null },
    connect: {
      success: true,
      data: { ...mockDevice, connected: true },
    },
    disconnect: {
      success: true,
      data: { ...mockDevice, connected: false },
    },
    scan: { success: true, data: [mockDevice] },
  },
  buttons: {
    getAll: { success: true, data: mockButtons },
    getById: { success: true, data: mockButton },
    create: { success: true, data: mockButton },
    update: { success: true, data: mockButton },
    delete: { success: true, data: null },
    test: {
      success: true,
      data: { executed: true, timestamp: new Date().toISOString() },
    },
  },
  config: {
    get: {
      success: true,
      data: {
        id: 'config-1',
        autoConnect: true,
        connectionTimeout: 5000,
        n8nBaseUrl: 'http://localhost:5678',
        n8nApiKey: 'test-api-key',
        defaultButtonBackgroundColor: '#000000',
        defaultTextColor: '#ffffff',
        defaultFontSize: 12,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as AppConfigResponse,
    },
    update: {
      success: true,
      data: {
        id: 'config-1',
        autoConnect: false,
        connectionTimeout: 10000,
        n8nBaseUrl: 'http://localhost:5678',
        n8nApiKey: 'test-api-key',
        defaultButtonBackgroundColor: '#ffffff',
        defaultTextColor: '#000000',
        defaultFontSize: 14,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as AppConfigResponse,
    },
    health: {
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
      } as HealthCheckResponse,
    },
  },
};

export const mockSocketEvents = {
  deviceConnected: {
    type: 'device-connected',
    deviceId: mockDevice.id,
    timestamp: new Date().toISOString(),
    device: mockDevice,
  },
  deviceDisconnected: {
    type: 'device-disconnected',
    deviceId: mockDevice.id,
    timestamp: new Date().toISOString(),
    device: { ...mockDevice, connected: false },
  },
  buttonPressed: {
    type: 'button-pressed',
    deviceId: mockDevice.id,
    buttonPosition: mockButton.position,
    timestamp: new Date().toISOString(),
    button: mockButton,
  },
  buttonUpdated: {
    type: 'button:updated',
    data: mockButton,
  },
};
