'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/utils/api';
import { StreamDeckButton, ButtonConfiguration } from '@/types/streamdeck';

export function useButtons(deviceId: string) {
  return useQuery({
    queryKey: ['buttons', deviceId],
    queryFn: () =>
      apiClient.get<StreamDeckButton[]>(`/api/devices/${deviceId}/buttons`),
    enabled: !!deviceId,
    retry: 2,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useButton(deviceId: string, buttonId: string) {
  return useQuery({
    queryKey: ['buttons', deviceId, buttonId],
    queryFn: () =>
      apiClient.get<StreamDeckButton>(
        `/api/devices/${deviceId}/buttons/${buttonId}`
      ),
    enabled: !!deviceId && !!buttonId,
    retry: 2,
  });
}

export function useUpdateButton() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      buttonId,
      config,
    }: {
      deviceId: string;
      buttonId: string;
      config: Partial<ButtonConfiguration>;
    }) =>
      apiClient.put<StreamDeckButton>(
        `/api/devices/${deviceId}/buttons/${buttonId}`,
        config
      ),
    onSuccess: (_, { deviceId }) => {
      queryClient.invalidateQueries({ queryKey: ['buttons', deviceId] });
    },
  });
}

export function useCreateButton() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      config,
    }: {
      deviceId: string;
      config: ButtonConfiguration;
    }) =>
      apiClient.post<StreamDeckButton>(
        `/api/devices/${deviceId}/buttons`,
        config
      ),
    onSuccess: (_, { deviceId }) => {
      queryClient.invalidateQueries({ queryKey: ['buttons', deviceId] });
    },
  });
}

export function useDeleteButton() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      buttonId,
    }: {
      deviceId: string;
      buttonId: string;
    }) => apiClient.delete(`/api/devices/${deviceId}/buttons/${buttonId}`),
    onSuccess: (_, { deviceId }) => {
      queryClient.invalidateQueries({ queryKey: ['buttons', deviceId] });
    },
  });
}

export function useUploadButtonIcon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      buttonId,
      file,
    }: {
      deviceId: string;
      buttonId: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append('icon', file);

      return fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/devices/${deviceId}/buttons/${buttonId}/icon`,
        {
          method: 'POST',
          body: formData,
        }
      ).then((res) => res.json());
    },
    onSuccess: (_, { deviceId }) => {
      queryClient.invalidateQueries({ queryKey: ['buttons', deviceId] });
    },
  });
}
