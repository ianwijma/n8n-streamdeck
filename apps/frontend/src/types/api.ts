// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

// Device API Types
export interface DeviceResponse {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  connected: boolean;
  buttonCount: number;
  columns: number;
  rows: number;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceConnectionRequest {
  deviceId: string;
}

export interface DeviceUpdateRequest {
  name?: string;
}

// Button API Types
export interface ButtonResponse {
  id: string;
  deviceId: string;
  position: number;
  title?: string;
  icon?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  action?: ButtonActionResponse;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ButtonActionResponse {
  type: 'webhook' | 'n8n-workflow' | 'system-command' | 'hotkey' | 'text-input';
  config:
    | WebhookActionConfig
    | N8nWorkflowActionConfig
    | SystemCommandActionConfig
    | HotkeyActionConfig
    | TextInputActionConfig;
}

export interface WebhookActionConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}

export interface N8nWorkflowActionConfig {
  workflowId: string;
  webhookUrl: string;
  payload?: Record<string, any>;
}

export interface SystemCommandActionConfig {
  command: string;
  args?: string[];
  workingDirectory?: string;
}

export interface HotkeyActionConfig {
  keys: string[];
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[];
}

export interface TextInputActionConfig {
  text: string;
  delay?: number;
}

export interface ButtonCreateRequest {
  position: number;
  title?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  action?: ButtonActionResponse;
  enabled?: boolean;
}

export interface ButtonUpdateRequest {
  title?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  action?: ButtonActionResponse;
  enabled?: boolean;
  position?: number;
}

export interface ButtonIconUploadResponse {
  iconUrl: string;
}

// Configuration API Types
export interface AppConfigResponse {
  id: string;
  autoConnect: boolean;
  connectionTimeout: number;
  n8nBaseUrl?: string;
  n8nApiKey?: string;
  defaultButtonBackgroundColor: string;
  defaultTextColor: string;
  defaultFontSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfigUpdateRequest {
  autoConnect?: boolean;
  connectionTimeout?: number;
  n8nBaseUrl?: string;
  n8nApiKey?: string;
  defaultButtonBackgroundColor?: string;
  defaultTextColor?: string;
  defaultFontSize?: number;
}

// Health Check Types
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: 'healthy' | 'unhealthy';
    streamdeck: 'healthy' | 'unhealthy';
  };
}

// WebSocket Event Types
export interface DeviceEvent {
  type:
    | 'device-connected'
    | 'device-disconnected'
    | 'button-pressed'
    | 'button-released';
  deviceId: string;
  buttonPosition?: number;
  timestamp: string;
  data?: any;
}

export interface ButtonPressEvent extends DeviceEvent {
  type: 'button-pressed' | 'button-released';
  buttonPosition: number;
  button?: ButtonResponse;
}

export interface DeviceConnectionEvent extends DeviceEvent {
  type: 'device-connected' | 'device-disconnected';
  device: DeviceResponse;
}

// Statistics Types
export interface DeviceStatsResponse {
  totalDevices: number;
  connectedDevices: number;
  totalButtons: number;
  configuredButtons: number;
  buttonPressesToday: number;
  lastActivity?: string;
}

// Export/Import Types
export interface DeviceConfigExport {
  device: DeviceResponse;
  buttons: ButtonResponse[];
  exportedAt: string;
  version: string;
}

export interface DeviceConfigImport {
  buttons: ButtonCreateRequest[];
  overwriteExisting?: boolean;
}
