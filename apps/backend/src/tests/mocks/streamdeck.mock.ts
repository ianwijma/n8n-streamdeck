import { EventEmitter } from 'events';
import { jest } from '@jest/globals';

// Mock StreamDeck device info
export interface MockStreamDeckDeviceInfo {
  path: string;
  model: string;
  serialNumber: string;
}

// Mock StreamDeck device
export class MockStreamDeck extends EventEmitter {
  private isOpen = false;
  private brightness = 75;
  private buttonStates: Buffer[] = [];

  constructor(public deviceInfo: MockStreamDeckDeviceInfo) {
    super();
    // Initialize button states
    this.buttonStates = new Array(32)
      .fill(null)
      .map(() => Buffer.alloc(72 * 72 * 3));
  }

  async open(): Promise<void> {
    if (this.isOpen) {
      throw new Error('Device is already open');
    }
    this.isOpen = true;
    this.emit('open');
  }

  async close(): Promise<void> {
    if (!this.isOpen) {
      return;
    }
    this.isOpen = false;
    this.emit('close');
  }

  async getFirmwareVersion(): Promise<string> {
    if (!this.isOpen) {
      throw new Error('Device is not open');
    }
    return '1.0.3';
  }

  async setBrightness(brightness: number): Promise<void> {
    if (!this.isOpen) {
      throw new Error('Device is not open');
    }
    if (brightness < 0 || brightness > 100) {
      throw new Error('Brightness must be between 0 and 100');
    }
    this.brightness = brightness;
  }

  async getBrightness(): Promise<number> {
    if (!this.isOpen) {
      throw new Error('Device is not open');
    }
    return this.brightness;
  }

  async fillKeyBuffer(keyIndex: number, buffer: Buffer): Promise<void> {
    if (!this.isOpen) {
      throw new Error('Device is not open');
    }
    if (keyIndex < 0 || keyIndex >= this.buttonStates.length) {
      throw new Error(`Key index ${keyIndex} is out of range`);
    }
    this.buttonStates[keyIndex] = buffer;
  }

  async clearKey(keyIndex: number): Promise<void> {
    if (!this.isOpen) {
      throw new Error('Device is not open');
    }
    if (keyIndex < 0 || keyIndex >= this.buttonStates.length) {
      throw new Error(`Key index ${keyIndex} is out of range`);
    }
    this.buttonStates[keyIndex] = Buffer.alloc(72 * 72 * 3);
  }

  async clearAllKeys(): Promise<void> {
    if (!this.isOpen) {
      throw new Error('Device is not open');
    }
    this.buttonStates = new Array(32)
      .fill(null)
      .map(() => Buffer.alloc(72 * 72 * 3));
  }

  // Test helper methods
  simulateButtonPress(keyIndex: number): void {
    if (!this.isOpen) {
      return;
    }
    this.emit('down', { index: keyIndex });
  }

  simulateButtonRelease(keyIndex: number): void {
    if (!this.isOpen) {
      return;
    }
    this.emit('up', { index: keyIndex });
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }

  simulateDisconnect(): void {
    this.isOpen = false;
    this.emit('close');
  }

  // Getters for testing
  get isDeviceOpen(): boolean {
    return this.isOpen;
  }

  get deviceBrightness(): number {
    return this.brightness;
  }

  getButtonState(keyIndex: number): Buffer {
    return this.buttonStates[keyIndex];
  }
}

// Mock device list
const mockDevices: MockStreamDeckDeviceInfo[] = [
  {
    path: '/dev/hidraw0',
    model: 'streamdeck-original',
    serialNumber: 'SD001234567890',
  },
  {
    path: '/dev/hidraw1',
    model: 'streamdeck-mini',
    serialNumber: 'SD001234567891',
  },
  {
    path: '/dev/hidraw2',
    model: 'streamdeck-xl',
    serialNumber: 'CL49K2A03951',
  },
];

// Mock functions
export const listStreamDecks = jest
  .fn<() => Promise<MockStreamDeckDeviceInfo[]>>()
  .mockResolvedValue(mockDevices);

export const openStreamDeck = jest
  .fn<(path: string) => Promise<MockStreamDeck>>()
  .mockImplementation(async (path: string) => {
    const deviceInfo = mockDevices.find((d) => d.path === path);
    if (!deviceInfo) {
      throw new Error(`Device not found at path: ${path}`);
    }

    const device = new MockStreamDeck(deviceInfo);
    // Open the device immediately
    await device.open();
    return device;
  });

// Export mock device info for tests
export { mockDevices };

// Default export for module replacement
export default {
  listStreamDecks,
  openStreamDeck,
  MockStreamDeck,
  mockDevices,
};
