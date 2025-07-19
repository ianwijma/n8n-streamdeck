'use client';

import React from 'react';
import { DeviceResponse } from '@/types/api';
import { useConnectDevice, useDisconnectDevice } from '@/hooks/useDevices';
import DeviceCard from './DeviceCard';

interface DeviceCardContainerProps {
  device: DeviceResponse;
  onClick?: (device: DeviceResponse) => void;
  className?: string;
}

export default function DeviceCardContainer({
  device,
  onClick,
  className = '',
}: DeviceCardContainerProps) {
  const connectDevice = useConnectDevice();
  const disconnectDevice = useDisconnectDevice();

  const handleConnectionToggle = async (device: DeviceResponse) => {
    if (device.connected) {
      await disconnectDevice.mutateAsync(device.id);
    } else {
      await connectDevice.mutateAsync(device.id);
    }
  };

  return (
    <DeviceCard
      device={device}
      isConnecting={connectDevice.isPending}
      isDisconnecting={disconnectDevice.isPending}
      onClick={onClick}
      onConnectionToggle={handleConnectionToggle}
      className={className}
    />
  );
}
