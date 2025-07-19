export interface StreamDeckDevice {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  connected: boolean;
  buttonCount: number;
  columns: number;
  rows: number;
  lastSeen?: Date;
}

export interface StreamDeckButton {
  id: string;
  deviceId: string;
  position: number;
  title?: string;
  icon?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  action?: ButtonAction;
  enabled: boolean;
}

export interface ButtonAction {
  type: 'webhook' | 'n8n-workflow' | 'system-command' | 'hotkey' | 'text-input';
  config:
    | WebhookAction
    | N8nWorkflowAction
    | SystemCommandAction
    | HotkeyAction
    | TextInputAction;
}

export interface WebhookAction {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}

export interface N8nWorkflowAction {
  workflowId: string;
  webhookUrl: string;
  payload?: Record<string, any>;
}

export interface SystemCommandAction {
  command: string;
  args?: string[];
  workingDirectory?: string;
}

export interface HotkeyAction {
  keys: string[];
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[];
}

export interface TextInputAction {
  text: string;
  delay?: number;
}

export interface DeviceEvent {
  type:
    | 'device-connected'
    | 'device-disconnected'
    | 'button-pressed'
    | 'button-released';
  deviceId: string;
  buttonPosition?: number;
  timestamp: Date;
}

export interface ButtonConfiguration {
  position: number;
  title?: string;
  icon?: File | string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  action?: ButtonAction;
  enabled: boolean;
}
