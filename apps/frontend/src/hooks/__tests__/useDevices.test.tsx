import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDevices } from '../useDevices';
import { deviceService } from '../../services/api/deviceService';
import { mockDevice } from '../../tests/mocks';

// Mock the device service
jest.mock('../../services/api/deviceService');
const mockedDeviceService = deviceService as jest.Mocked<typeof deviceService>;

// Create wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
};

describe('useDevices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch devices successfully', async () => {
    mockedDeviceService.getDevices.mockResolvedValue([mockDevice]);

    const { result } = renderHook(() => useDevices(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([mockDevice]);
    expect(result.current.error).toBe(null);
  });

  it('should handle fetch error', async () => {
    const error = new Error('Failed to fetch devices');
    mockedDeviceService.getDevices.mockRejectedValue(error);

    const { result } = renderHook(() => useDevices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeUndefined();
  });

  it('should provide refetch function', async () => {
    mockedDeviceService.getDevices.mockResolvedValue([mockDevice]);

    const { result } = renderHook(() => useDevices(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');
  });
});
