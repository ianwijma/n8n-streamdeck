// Mock data for Storybook
const mockDevice = {
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

const mockDisconnectedDevice = {
  ...mockDevice,
  id: 'test-device-2',
  name: 'Disconnected StreamDeck',
  connected: false,
};

// Mock hooks for Storybook with realistic data
export const useDevices = () => ({
  data: [mockDevice, mockDisconnectedDevice],
  isLoading: false,
  error: null,
  refetch: () => Promise.resolve(),
});

export const useConnectDevice = () => ({
  mutateAsync: (deviceId: string) => {
    console.log('Mock: Connecting device', deviceId);
    return Promise.resolve({ ...mockDevice, connected: true });
  },
  isPending: false,
});

export const useDisconnectDevice = () => ({
  mutateAsync: (deviceId: string) => {
    console.log('Mock: Disconnecting device', deviceId);
    return Promise.resolve({ ...mockDevice, connected: false });
  },
  isPending: false,
});

export const useScanDevices = () => ({
  mutateAsync: () => {
    console.log('Mock: Scanning for devices');
    return Promise.resolve([mockDevice]);
  },
  isPending: false,
});
