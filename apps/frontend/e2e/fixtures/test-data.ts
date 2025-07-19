import { DeviceResponse, ButtonResponse } from '../../src/types/api';

export const mockDevices: DeviceResponse[] = [
  {
    id: 'device-1',
    name: 'StreamDeck MK.2',
    model: 'streamdeck-mk2',
    serialNumber: 'CL12345678',
    buttonCount: 15,
    columns: 5,
    rows: 3,
    connected: true,
    firmwareVersion: '1.0.0',
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'device-2',
    name: 'StreamDeck Mini',
    model: 'streamdeck-mini',
    serialNumber: 'CL87654321',
    buttonCount: 6,
    columns: 3,
    rows: 2,
    connected: false,
    firmwareVersion: '1.0.0',
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'device-3',
    name: 'StreamDeck XL',
    model: 'streamdeck-xl',
    serialNumber: 'CL11223344',
    buttonCount: 32,
    columns: 8,
    rows: 4,
    connected: true,
    firmwareVersion: '1.0.0',
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  },
];

export const mockButtons: ButtonResponse[] = [
  {
    id: 'button-1',
    deviceId: 'device-1',
    position: 0,
    title: 'Webhook Button',
    enabled: true,
    action: {
      type: 'webhook',
      config: {
        url: 'https://httpbin.org/post',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"message": "Hello from StreamDeck"}',
      },
    },
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'button-2',
    deviceId: 'device-1',
    position: 1,
    title: 'N8N Workflow',
    enabled: true,
    action: {
      type: 'n8n-workflow',
      config: {
        workflowId: 'workflow-123',
        webhookUrl: 'https://n8n.example.com/webhook/streamdeck',
        payload: { source: 'streamdeck' },
      },
    },
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'button-3',
    deviceId: 'device-1',
    position: 2,
    title: 'Copy Shortcut',
    enabled: true,
    action: {
      type: 'hotkey',
      config: {
        keys: ['ctrl', 'c'],
        modifiers: ['ctrl'],
      },
    },
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  },
];

export const createMockDevice = (
  overrides: Partial<DeviceResponse> = {}
): DeviceResponse => ({
  id: `device-${Date.now()}`,
  name: 'Test Device',
  model: 'streamdeck-mk2',
  serialNumber: `CL${Math.random().toString().slice(2, 10)}`,
  buttonCount: 15,
  columns: 5,
  rows: 3,
  connected: true,
  firmwareVersion: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockButton = (
  overrides: Partial<ButtonResponse> = {}
): ButtonResponse => ({
  id: `button-${Date.now()}`,
  deviceId: 'device-1',
  position: 0,
  title: 'Test Button',
  enabled: true,
  action: {
    type: 'webhook',
    config: {
      url: 'https://httpbin.org/post',
      method: 'POST',
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const n8nWorkflowMock = {
  id: 'workflow-123',
  name: 'Test Workflow',
  active: true,
  nodes: [
    {
      id: 'trigger-node',
      type: 'n8n-nodes-base.streamDeckTrigger',
      name: 'StreamDeck Trigger',
      position: [250, 300],
      parameters: {
        deviceId: 'device-1',
        buttonIndex: 1,
      },
    },
    {
      id: 'webhook-node',
      type: 'n8n-nodes-base.httpRequest',
      name: 'HTTP Request',
      position: [450, 300],
      parameters: {
        url: 'https://httpbin.org/post',
        method: 'POST',
      },
    },
  ],
  connections: {
    'StreamDeck Trigger': {
      main: [
        [
          {
            node: 'HTTP Request',
            type: 'main',
            index: 0,
          },
        ],
      ],
    },
  },
};
