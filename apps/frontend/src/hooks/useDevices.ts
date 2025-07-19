'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/utils/api';
import { StreamDeckDevice } from '@/types/streamdeck';

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => apiClient.get<StreamDeckDevice[]>('/api/devices'),
    refetchInterval: 5000,
    retry: 2,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function useDevice(deviceId: string) {
  return useQuery({
    queryKey: ['devices', deviceId],
    queryFn: () => apiClient.get<StreamDeckDevice>(`/api/devices/${deviceId}`),
    enabled: !!deviceId,
    retry: 2,
  });
}

export function useConnectDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) =>
      apiClient.post<StreamDeckDevice>(`/api/devices/${deviceId}/connect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}

export function useDisconnectDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) =>
      apiClient.post<StreamDeckDevice>(`/api/devices/${deviceId}/disconnect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });
}
