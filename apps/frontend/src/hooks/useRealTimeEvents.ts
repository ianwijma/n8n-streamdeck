'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import {
  DeviceEvent,
  DeviceConnectionEvent,
  ButtonPressEvent,
} from '@/types/api';
import { deviceKeys } from '@/hooks/useDevices';
import { buttonKeys } from '@/hooks/useButtons';

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

export function useRealTimeEvents(options: UseRealTimeEventsOptions = {}) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  // Check if we're in Storybook environment
  const isStorybook =
    typeof window !== 'undefined' &&
    (window.location.pathname.includes('iframe.html') ||
      window.parent !== window ||
      (window as any).__STORYBOOK_ADDONS_CHANNEL__ ||
      window.location.port === '6006');

  const handleDeviceEvent = useCallback(
    (event: DeviceEvent | DeviceConnectionEvent | ButtonPressEvent | any) => {
      console.log('Received device event:', event);

      switch (event.type) {
        case 'device-connected':
        case 'device-disconnected':
          // Invalidate device queries to refetch updated data
          queryClient.invalidateQueries({ queryKey: deviceKeys.all });

          const connectionEvent = event as DeviceConnectionEvent;
          if (event.type === 'device-connected') {
            options.onDeviceConnected?.(event.deviceId, connectionEvent.device);
          } else {
            options.onDeviceDisconnected?.(
              event.deviceId,
              connectionEvent.device
            );
          }
          break;

        case 'button-pressed':
          const pressEvent = event as ButtonPressEvent;
          options.onButtonPressed?.(
            event.deviceId,
            pressEvent.buttonPosition,
            pressEvent.button
          );
          break;

        case 'button-released':
          const releaseEvent = event as ButtonPressEvent;
          options.onButtonReleased?.(
            event.deviceId,
            releaseEvent.buttonPosition,
            releaseEvent.button
          );
          break;

        case 'button:updated':
          // Invalidate button queries to refetch updated data
          queryClient.invalidateQueries({ queryKey: buttonKeys.all });
          break;

        default:
          console.warn('Unknown device event type:', event);
      }
    },
    [queryClient, options]
  );
  useEffect(() => {
    // Skip WebSocket connection in Storybook
    if (isStorybook) {
      console.log('Skipping WebSocket connection in Storybook');
      return;
    }

    // Create socket connection
    const socket = io('http://localhost:3001', {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to StreamDeck WebSocket');
      options.onConnect?.();
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from StreamDeck WebSocket');
    });

    socket.on('device-event', handleDeviceEvent);

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [handleDeviceEvent, isStorybook]);

  const isConnected = socketRef.current?.connected ?? false;

  return {
    isConnected,
    socket: socketRef.current,
  };
}
