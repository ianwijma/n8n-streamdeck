'use client';

import React, { useState, useEffect } from 'react';
import { DeviceResponse, ButtonResponse } from '@/types/api';
import { useButtons, useUpdateButton } from '@/hooks/useButtons';
import { useRealTimeEvents } from '@/hooks/useRealTimeEvents';
import ButtonGrid from './ButtonGrid';

interface ButtonGridContainerProps {
  device: DeviceResponse;
  onButtonClick?: (button: ButtonResponse | null, position: number) => void;
  recentlyModifiedPosition?: number;
  className?: string;
}

export default function ButtonGridContainer({
  device,
  onButtonClick,
  recentlyModifiedPosition,
  className = '',
}: ButtonGridContainerProps) {
  const { data: buttons, isLoading, error } = useButtons(device.id);
  const updateButton = useUpdateButton();
  const [pressedButtons, setPressedButtons] = useState<Set<number>>(new Set());
  const [recentlyModifiedButtons, setRecentlyModifiedButtons] = useState<
    Set<number>
  >(new Set());

  useRealTimeEvents({
    onButtonPressed: (deviceId, buttonPosition) => {
      if (deviceId === device.id) {
        setPressedButtons((prev) => new Set(prev).add(buttonPosition));
      }
    },
    onButtonReleased: (deviceId, buttonPosition) => {
      if (deviceId === device.id) {
        setPressedButtons((prev) => {
          const newSet = new Set(prev);
          newSet.delete(buttonPosition);
          return newSet;
        });
      }
    },
  });

  // Track recently modified buttons and clear them after a delay
  useEffect(() => {
    if (recentlyModifiedButtons.size > 0) {
      const timer = setTimeout(() => {
        setRecentlyModifiedButtons(new Set());
      }, 3000); // Clear after 3 seconds

      return () => clearTimeout(timer);
    }
  }, [recentlyModifiedButtons]);

  // Mark button as recently modified when prop changes
  useEffect(() => {
    if (recentlyModifiedPosition !== undefined) {
      markButtonAsRecentlyModified(recentlyModifiedPosition);
    }
  }, [recentlyModifiedPosition]);

  const markButtonAsRecentlyModified = (position: number) => {
    setRecentlyModifiedButtons((prev) => new Set(prev).add(position));
  };

  const handleButtonReorder = async (
    oldIndex: number,
    newIndex: number,
    oldButton: ButtonResponse | null,
    newButton: ButtonResponse | null
  ) => {
    try {
      if (oldButton) {
        await updateButton.mutateAsync({
          deviceId: device.id,
          buttonId: oldButton.id,
          config: { position: newIndex },
        });
        markButtonAsRecentlyModified(newIndex);
      }

      if (newButton) {
        await updateButton.mutateAsync({
          deviceId: device.id,
          buttonId: newButton.id,
          config: { position: oldIndex },
        });
        markButtonAsRecentlyModified(oldIndex);
      }
    } catch (error) {
      console.error('Failed to reorder buttons:', error);
      throw error;
    }
  };

  return (
    <ButtonGrid
      device={device}
      buttons={buttons || []}
      isLoading={isLoading}
      error={error}
      pressedButtons={pressedButtons}
      recentlyModifiedButtons={recentlyModifiedButtons}
      onButtonClick={onButtonClick}
      onButtonReorder={handleButtonReorder}
      className={className}
    />
  );
}
