'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deviceService } from '@/services/api/deviceService';
import { DeviceResponse, DeviceUpdateRequest } from '@/types/api';

// Query Keys
export const deviceKeys = {
  all: ['devices'] as const,
  lists: () => [...deviceKeys.all, 'list'] as const,
  list: (filters: string) => [...deviceKeys.lists(), { filters }] as const,
  details: () => [...deviceKeys.all, 'detail'] as const,
  detail: (id: string) => [...deviceKeys.details(), id] as const,
  stats: () => [...deviceKeys.all, 'stats'] as const,
};

// Queries
export function useDevices() {
  return useQuery({
    queryKey: deviceKeys.lists(),
    queryFn: () => deviceService.getDevices(),
    refetchInterval: 5000,
    retry: 2,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useDevice(deviceId: string) {
  return useQuery({
    queryKey: deviceKeys.detail(deviceId),
    queryFn: () => deviceService.getDevice(deviceId),
    enabled: !!deviceId,
    retry: 2,
  });
}

export function useDeviceStats(deviceId?: string) {
  return useQuery({
    queryKey: deviceId ? [...deviceKeys.stats(), deviceId] : deviceKeys.stats(),
    queryFn: () => deviceService.getDeviceStats(deviceId),
    refetchInterval: 30000, // 30 seconds
  });
}

// Mutations
export function useConnectDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => deviceService.connectDevice(deviceId),
    onMutate: async (deviceId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: deviceKeys.detail(deviceId),
      });

      // Snapshot previous value
      const previousDevice = queryClient.getQueryData<DeviceResponse>(
        deviceKeys.detail(deviceId)
      );

      // Optimistically update
      if (previousDevice) {
        queryClient.setQueryData<DeviceResponse>(deviceKeys.detail(deviceId), {
          ...previousDevice,
          connected: true,
        });
      }

      return { previousDevice };
    },
    onError: (_err, deviceId, context) => {
      // Rollback on error
      if (context?.previousDevice) {
        queryClient.setQueryData(
          deviceKeys.detail(deviceId),
          context.previousDevice
        );
      }
    },
    onSettled: (_data, _error, deviceId) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: deviceKeys.detail(deviceId) });
    },
  });
}

export function useDisconnectDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => deviceService.disconnectDevice(deviceId),
    onMutate: async (deviceId) => {
      await queryClient.cancelQueries({
        queryKey: deviceKeys.detail(deviceId),
      });

      const previousDevice = queryClient.getQueryData<DeviceResponse>(
        deviceKeys.detail(deviceId)
      );

      if (previousDevice) {
        queryClient.setQueryData<DeviceResponse>(deviceKeys.detail(deviceId), {
          ...previousDevice,
          connected: false,
        });
      }

      return { previousDevice };
    },
    onError: (_err, deviceId, context) => {
      if (context?.previousDevice) {
        queryClient.setQueryData(
          deviceKeys.detail(deviceId),
          context.previousDevice
        );
      }
    },
    onSettled: (_data, _error, deviceId) => {
      queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: deviceKeys.detail(deviceId) });
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      data,
    }: {
      deviceId: string;
      data: DeviceUpdateRequest;
    }) => deviceService.updateDevice(deviceId, data),
    onSuccess: (data, { deviceId }) => {
      queryClient.setQueryData(deviceKeys.detail(deviceId), data);
      queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => deviceService.deleteDevice(deviceId),
    onSuccess: (_data, deviceId) => {
      queryClient.removeQueries({ queryKey: deviceKeys.detail(deviceId) });
      queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
}

export function useScanDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deviceService.scanDevices(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
}

export function useResetDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => deviceService.resetDevice(deviceId),
    onSuccess: (data, deviceId) => {
      queryClient.setQueryData(deviceKeys.detail(deviceId), data);
      queryClient.invalidateQueries({ queryKey: ['buttons', deviceId] });
    },
  });
}

export function useTestDevice() {
  return useMutation({
    mutationFn: (deviceId: string) => deviceService.testDevice(deviceId),
  });
}
