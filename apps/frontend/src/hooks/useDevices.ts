'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/utils/api';

export interface Device {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  serialNumber?: string;
  firmwareVersion?: string;
}

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => apiClient.get<Device[]>('/api/devices'),
    refetchInterval: 5000, // Refetch every 5 seconds
  });
}

export function useDevice(deviceId: string) {
  return useQuery({
    queryKey: ['devices', deviceId],
    queryFn: () => apiClient.get<Device>(`/api/devices/${deviceId}`),
    enabled: !!deviceId,
  });
}
