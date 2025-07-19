// Mock for useRealTimeEvents hook to prevent WebSocket connections in Storybook

interface UseRealTimeEventsOptions {
  onDeviceConnected?: (deviceId: string, device?: any) => void;
  onDeviceDisconnected?: (deviceId: string, device?: any) => void;
  onButtonPressed?: (
    deviceId: string,
    buttonPosition: number,
    button?: any
  ) => void;
  onButtonReleased?: (
    deviceId: string,
    buttonPosition: number,
    button?: any
  ) => void;
  onError?: (error: any) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
}

export const useRealTimeEvents = (options: UseRealTimeEventsOptions = {}) => {
  // Mock implementation - no actual WebSocket connection
  // Just return empty object to satisfy the hook interface
  return {};
};
