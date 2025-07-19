export enum DeviceType {
  STREAMDECK_ORIGINAL = 'streamdeck-original',
  STREAMDECK_MINI = 'streamdeck-mini',
  STREAMDECK_XL = 'streamdeck-xl',
  STREAMDECK_MK2 = 'streamdeck-mk2',
  STREAMDECK_PLUS = 'streamdeck-plus',
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  serialNumber: string;
  buttonCount: number;
  isConnected: boolean;
  firmwareVersion?: string;
  brightness?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Button {
  id: string;
  deviceId: string;
  index: number;
  label?: string;
  icon?: string;
  iconData?: Buffer | string;
  action?: ButtonAction;
  isEnabled: boolean;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ButtonAction {
  type: ButtonActionType;
  payload: Record<string, any>;
  n8nWorkflowId?: string;
  webhookUrl?: string;
  command?: string;
  hotkey?: string[];
}

export enum ButtonActionType {
  TRIGGER_WORKFLOW = 'trigger-workflow',
  WEBHOOK = 'webhook',
  HOTKEY = 'hotkey',
  COMMAND = 'command',
  FOLDER = 'folder',
  BACK = 'back',
  NONE = 'none',
}

export interface Folder {
  id: string;
  name: string;
  buttons: string[]; // Array of button IDs
  parentId?: string; // For nested folders
  deviceId: string;
  icon?: string;
  backgroundColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceProfile {
  id: string;
  name: string;
  deviceId: string;
  buttons: Button[];
  folders: Folder[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Utility types for device operations
export type DeviceStatus = 'connected' | 'disconnected' | 'error';

export interface DeviceInfo {
  device: Device;
  status: DeviceStatus;
  lastSeen?: Date;
  errorMessage?: string;
}

// Button grid position for different device types
export interface ButtonPosition {
  row: number;
  column: number;
  index: number;
}

export const DEVICE_BUTTON_LAYOUTS: Record<DeviceType, { rows: number; columns: number }> = {
  [DeviceType.STREAMDECK_ORIGINAL]: { rows: 3, columns: 5 },
  [DeviceType.STREAMDECK_MINI]: { rows: 2, columns: 3 },
  [DeviceType.STREAMDECK_XL]: { rows: 4, columns: 8 },
  [DeviceType.STREAMDECK_MK2]: { rows: 3, columns: 5 },
  [DeviceType.STREAMDECK_PLUS]: { rows: 2, columns: 4 },
};