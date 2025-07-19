'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { DeviceEvent } from '@/types/streamdeck';

interface UseRealTimeEventsOptions {
  onDeviceConnected?: (deviceId: string) => void;
  onDeviceDisconnected?: (deviceId: string) => void;
  onButtonPressed?: (deviceId: string, buttonPosition: number) => void;
  onButtonReleased?: (deviceId: string, buttonPosition: number) => void;
}

export function useRealTimeEvents(options: UseRealTimeEventsOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

  const {
    onDeviceConnected,
    onDeviceDisconnected,
    onButtonPressed,
    onButtonReleased,
  } = options;

  const handleDeviceEvent = useCallback(
    (event: DeviceEvent) => {
      switch (event.type) {
        case 'device-connected':
          queryClient.invalidateQueries({ queryKey: ['devices'] });
          onDeviceConnected?.(event.deviceId);
          break;

        case 'device-disconnected':
          queryClient.invalidateQueries({ queryKey: ['devices'] });
          onDeviceDisconnected?.(event.deviceId);
          break;

        case 'button-pressed':
          if (event.buttonPosition !== undefined) {
            onButtonPressed?.(event.deviceId, event.buttonPosition);
          }
          break;

        case 'button-released':
          if (event.buttonPosition !== undefined) {
            onButtonReleased?.(event.deviceId, event.buttonPosition);
          }
          break;
      }
    },
    [
      queryClient,
      onDeviceConnected,
      onDeviceDisconnected,
      onButtonPressed,
      onButtonReleased,
    ]
  );

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

    socketRef.current = io(wsUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to StreamDeck WebSocket');
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
  }, [handleDeviceEvent]);

  const isConnected = socketRef.current?.connected ?? false;

  return {
    isConnected,
    socket: socketRef.current,
  };
}
