// Mock hooks for Storybook
export const useButtons = () => ({
  data: [],
  isLoading: false,
  error: null,
});

export const useUpdateButton = () => ({
  mutateAsync: () => Promise.resolve(),
  isPending: false,
});

export const useDeleteButton = () => ({
  mutateAsync: () => Promise.resolve(),
  isPending: false,
});

export const useConnectDevice = () => ({
  mutateAsync: () => Promise.resolve(),
  isPending: false,
});

export const useDisconnectDevice = () => ({
  mutateAsync: () => Promise.resolve(),
  isPending: false,
});

export const useDevices = () => ({
  data: [],
  isLoading: false,
  error: null,
});

export const useRealTimeEvents = () => ({});
