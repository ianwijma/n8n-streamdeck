'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buttonService } from '@/services/api/buttonService';
import {
  ButtonResponse,
  ButtonCreateRequest,
  ButtonUpdateRequest,
} from '@/types/api';

// Query Keys
export const buttonKeys = {
  all: ['buttons'] as const,
  lists: () => [...buttonKeys.all, 'list'] as const,
  list: (deviceId: string) => [...buttonKeys.lists(), deviceId] as const,
  details: () => [...buttonKeys.all, 'detail'] as const,
  detail: (deviceId: string, buttonId: string) =>
    [...buttonKeys.details(), deviceId, buttonId] as const,
  stats: (deviceId: string) => [...buttonKeys.all, 'stats', deviceId] as const,
};

// Queries
export function useButtons(deviceId: string) {
  return useQuery({
    queryKey: buttonKeys.list(deviceId),
    queryFn: () => buttonService.getButtons(deviceId),
    enabled: !!deviceId,
    retry: 2,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useButton(deviceId: string, buttonId: string) {
  return useQuery({
    queryKey: buttonKeys.detail(deviceId, buttonId),
    queryFn: () => buttonService.getButton(deviceId, buttonId),
    enabled: !!deviceId && !!buttonId,
    retry: 2,
  });
}

export function useButtonByPosition(deviceId: string, position: number) {
  return useQuery({
    queryKey: [...buttonKeys.all, 'position', deviceId, position],
    queryFn: () => buttonService.getButtonByPosition(deviceId, position),
    enabled: !!deviceId && position >= 0,
    retry: 2,
  });
}

export function useButtonStats(deviceId: string, buttonId?: string) {
  return useQuery({
    queryKey: buttonId
      ? [...buttonKeys.stats(deviceId), buttonId]
      : buttonKeys.stats(deviceId),
    queryFn: () => buttonService.getButtonStats(deviceId, buttonId),
    refetchInterval: 30000, // 30 seconds
  });
}

// Mutations
export function useCreateButton() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      config,
    }: {
      deviceId: string;
      config: ButtonCreateRequest;
    }) => buttonService.createButton(deviceId, config),
    onSuccess: (data, { deviceId }) => {
      queryClient.setQueryData<ButtonResponse[]>(
        buttonKeys.list(deviceId),
        (old) => (old ? [...old, data] : [data])
      );
      queryClient.invalidateQueries({ queryKey: buttonKeys.list(deviceId) });
    },
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
      config: ButtonUpdateRequest;
    }) => buttonService.updateButton(deviceId, buttonId, config),
    onMutate: async ({ deviceId, buttonId, config }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: buttonKeys.detail(deviceId, buttonId),
      });

      // Snapshot previous value
      const previousButton = queryClient.getQueryData<ButtonResponse>(
        buttonKeys.detail(deviceId, buttonId)
      );

      // Optimistically update
      if (previousButton) {
        queryClient.setQueryData<ButtonResponse>(
          buttonKeys.detail(deviceId, buttonId),
          { ...previousButton, ...config }
        );
      }

      return { previousButton };
    },
    onError: (err, { deviceId, buttonId }, context) => {
      // Rollback on error
      if (context?.previousButton) {
        queryClient.setQueryData(
          buttonKeys.detail(deviceId, buttonId),
          context.previousButton
        );
      }
    },
    onSuccess: (data, { deviceId, buttonId }) => {
      queryClient.setQueryData(buttonKeys.detail(deviceId, buttonId), data);
      queryClient.invalidateQueries({ queryKey: buttonKeys.list(deviceId) });
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
    }) => buttonService.deleteButton(deviceId, buttonId),
    onSuccess: (data, { deviceId, buttonId }) => {
      queryClient.removeQueries({
        queryKey: buttonKeys.detail(deviceId, buttonId),
      });
      queryClient.setQueryData<ButtonResponse[]>(
        buttonKeys.list(deviceId),
        (old) => (old ? old.filter((button) => button.id !== buttonId) : [])
      );
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
      onProgress,
    }: {
      deviceId: string;
      buttonId: string;
      file: File;
      onProgress?: (progress: number) => void;
    }) => buttonService.uploadButtonIcon(deviceId, buttonId, file, onProgress),
    onSuccess: (data, { deviceId, buttonId }) => {
      // Update the button with new icon URL
      queryClient.setQueryData<ButtonResponse>(
        buttonKeys.detail(deviceId, buttonId),
        (old) => (old ? { ...old, icon: data.iconUrl } : undefined)
      );
      queryClient.invalidateQueries({ queryKey: buttonKeys.list(deviceId) });
    },
  });
}

export function useTriggerButton() {
  return useMutation({
    mutationFn: ({
      deviceId,
      buttonId,
    }: {
      deviceId: string;
      buttonId: string;
    }) => buttonService.triggerButton(deviceId, buttonId),
  });
}

export function useTestButtonAction() {
  return useMutation({
    mutationFn: ({
      deviceId,
      buttonId,
    }: {
      deviceId: string;
      buttonId: string;
    }) => buttonService.testButtonAction(deviceId, buttonId),
  });
}

export function useCopyButton() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      buttonId,
      targetPosition,
    }: {
      deviceId: string;
      buttonId: string;
      targetPosition: number;
    }) => buttonService.copyButton(deviceId, buttonId, targetPosition),
    onSuccess: (data, { deviceId }) => {
      queryClient.invalidateQueries({ queryKey: buttonKeys.list(deviceId) });
    },
  });
}

export function useMoveButton() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      buttonId,
      newPosition,
    }: {
      deviceId: string;
      buttonId: string;
      newPosition: number;
    }) => buttonService.moveButton(deviceId, buttonId, newPosition),
    onSuccess: (data, { deviceId }) => {
      queryClient.invalidateQueries({ queryKey: buttonKeys.list(deviceId) });
    },
  });
}

export function useSwapButtons() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      deviceId,
      buttonId1,
      buttonId2,
    }: {
      deviceId: string;
      buttonId1: string;
      buttonId2: string;
    }) => buttonService.swapButtons(deviceId, buttonId1, buttonId2),
    onSuccess: (data, { deviceId }) => {
      queryClient.invalidateQueries({ queryKey: buttonKeys.list(deviceId) });
    },
  });
}

export function useClearAllButtons() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deviceId: string) => buttonService.clearAllButtons(deviceId),
    onSuccess: (data, deviceId) => {
      queryClient.setQueryData<ButtonResponse[]>(buttonKeys.list(deviceId), []);
    },
  });
}
