import { Device, Button, ButtonAction } from './device';

// Base event interface
export interface BaseEvent {
  id: string;
  timestamp: Date;
  source: 'device' | 'api' | 'system';
}

// Button events
export interface ButtonPressEvent extends BaseEvent {
  type: 'button-press';
  deviceId: string;
  buttonIndex: number;
  button?: Button;
  action?: ButtonAction;
  pressType: 'short' | 'long' | 'double';
  duration?: number; // in milliseconds
}

export interface ButtonReleaseEvent extends BaseEvent {
  type: 'button-release';
  deviceId: string;
  buttonIndex: number;
  button?: Button;
  pressDuration: number; // in milliseconds
}

export interface ButtonConfiguredEvent extends BaseEvent {
  type: 'button-configured';
  deviceId: string;
  buttonIndex: number;
  button: Button;
  previousConfig?: Partial<Button>;
}

// Device events
export interface DeviceConnectedEvent extends BaseEvent {
  type: 'device-connected';
  device: Device;
  isReconnection: boolean;
}

export interface DeviceDisconnectedEvent extends BaseEvent {
  type: 'device-disconnected';
  deviceId: string;
  device?: Device;
  reason: 'user-disconnect' | 'cable-unplugged' | 'error' | 'timeout';
  errorMessage?: string;
}

export interface DeviceErrorEvent extends BaseEvent {
  type: 'device-error';
  deviceId: string;
  device?: Device;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface DeviceBrightnessChangedEvent extends BaseEvent {
  type: 'device-brightness-changed';
  deviceId: string;
  brightness: number;
  previousBrightness: number;
}

// System events
export interface SystemStartedEvent extends BaseEvent {
  type: 'system-started';
  version: string;
  startupTime: number; // in milliseconds
}

export interface SystemShutdownEvent extends BaseEvent {
  type: 'system-shutdown';
  reason: 'user-request' | 'error' | 'signal';
}

export interface WorkflowTriggeredEvent extends BaseEvent {
  type: 'workflow-triggered';
  workflowId: string;
  workflowName?: string;
  deviceId: string;
  buttonIndex: number;
  executionId?: string;
  payload?: Record<string, any>;
}

export interface WorkflowCompletedEvent extends BaseEvent {
  type: 'workflow-completed';
  workflowId: string;
  executionId: string;
  status: 'success' | 'error' | 'cancelled';
  duration: number; // in milliseconds
  error?: string;
}

// Profile events
export interface ProfileSwitchedEvent extends BaseEvent {
  type: 'profile-switched';
  deviceId: string;
  profileId: string;
  profileName: string;
  previousProfileId?: string;
}

// Union type for all events
export type StreamDeckEvent =
  | ButtonPressEvent
  | ButtonReleaseEvent
  | ButtonConfiguredEvent
  | DeviceConnectedEvent
  | DeviceDisconnectedEvent
  | DeviceErrorEvent
  | DeviceBrightnessChangedEvent
  | SystemStartedEvent
  | SystemShutdownEvent
  | WorkflowTriggeredEvent
  | WorkflowCompletedEvent
  | ProfileSwitchedEvent;

// Event type enum for easier filtering
export enum EventType {
  BUTTON_PRESS = 'button-press',
  BUTTON_RELEASE = 'button-release',
  BUTTON_CONFIGURED = 'button-configured',
  DEVICE_CONNECTED = 'device-connected',
  DEVICE_DISCONNECTED = 'device-disconnected',
  DEVICE_ERROR = 'device-error',
  DEVICE_BRIGHTNESS_CHANGED = 'device-brightness-changed',
  SYSTEM_STARTED = 'system-started',
  SYSTEM_SHUTDOWN = 'system-shutdown',
  WORKFLOW_TRIGGERED = 'workflow-triggered',
  WORKFLOW_COMPLETED = 'workflow-completed',
  PROFILE_SWITCHED = 'profile-switched',
}

// Event listener types
export type EventListener<T extends StreamDeckEvent = StreamDeckEvent> = (event: T) => void | Promise<void>;

export interface EventSubscription {
  id: string;
  eventType: EventType | EventType[];
  listener: EventListener;
  once?: boolean;
  deviceId?: string; // Filter events for specific device
}

// Event emitter interface
export interface EventEmitter {
  on<T extends StreamDeckEvent>(eventType: T['type'], listener: EventListener<T>): string;
  once<T extends StreamDeckEvent>(eventType: T['type'], listener: EventListener<T>): string;
  off(subscriptionId: string): boolean;
  emit(event: StreamDeckEvent): Promise<void>;
  removeAllListeners(eventType?: EventType): void;
}

// Utility functions for events
export const createEvent = <T extends StreamDeckEvent>(
  type: T['type'],
  data: Omit<T, 'id' | 'timestamp' | 'type' | 'source'>,
  eventSource: BaseEvent['source'] = 'system'
): T => ({
  id: crypto.randomUUID(),
  timestamp: new Date(),
  type,
  source: eventSource,
  ...data,
} as T);

export const isButtonEvent = (event: StreamDeckEvent): event is ButtonPressEvent | ButtonReleaseEvent | ButtonConfiguredEvent => {
  return ['button-press', 'button-release', 'button-configured'].includes(event.type);
};

export const isDeviceEvent = (event: StreamDeckEvent): event is DeviceConnectedEvent | DeviceDisconnectedEvent | DeviceErrorEvent => {
  return ['device-connected', 'device-disconnected', 'device-error'].includes(event.type);
};

export const isSystemEvent = (event: StreamDeckEvent): event is SystemStartedEvent | SystemShutdownEvent => {
  return ['system-started', 'system-shutdown'].includes(event.type);
};

export const isWorkflowEvent = (event: StreamDeckEvent): event is WorkflowTriggeredEvent | WorkflowCompletedEvent => {
  return ['workflow-triggered', 'workflow-completed'].includes(event.type);
};