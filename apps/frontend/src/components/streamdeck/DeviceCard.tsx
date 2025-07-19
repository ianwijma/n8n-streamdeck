'use client';

import React, { useCallback, useMemo } from 'react';
import { DeviceResponse } from '@/types/api';

interface DeviceCardProps {
  device: DeviceResponse;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
  onClick?: (device: DeviceResponse) => void;
  onConnectionToggle?: (device: DeviceResponse) => Promise<void>;
  className?: string;
}

const DeviceCard = React.memo<DeviceCardProps>(
  ({
    device,
    isConnecting = false,
    isDisconnecting = false,
    onClick,
    onConnectionToggle,
    className = '',
  }: DeviceCardProps) => {
    const handleConnectionToggle = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (onConnectionToggle) {
          try {
            await onConnectionToggle(device);
          } catch (error) {
            console.error('Failed to toggle device connection:', error);
          }
        }
      },
      [onConnectionToggle, device]
    );

    const handleCardClick = useCallback(() => {
      onClick?.(device);
    }, [onClick, device]);

    const isLoading = useMemo(
      () => isConnecting || isDisconnecting,
      [isConnecting, isDisconnecting]
    );

    const statusColor = useMemo(
      () => (device.connected ? 'bg-green-400' : 'bg-red-400'),
      [device.connected]
    );

    const buttonStyles = useMemo(
      () =>
        device.connected
          ? 'bg-red-100 text-red-800 hover:bg-red-200'
          : 'bg-green-100 text-green-800 hover:bg-green-200',
      [device.connected]
    );

    const buttonText = useMemo(() => {
      if (isLoading) return 'Loading...';
      return device.connected ? 'Disconnect' : 'Connect';
    }, [isLoading, device.connected]);

    const lastSeenFormatted = useMemo(
      () =>
        device.lastSeen ? new Date(device.lastSeen).toLocaleString() : null,
      [device.lastSeen]
    );

    return (
      <div
        className={`bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer ${className}`}
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {device.name}
              </h3>
              <p className="text-sm text-gray-500">{device.model}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${statusColor}`}
              title={device.connected ? 'Connected' : 'Disconnected'}
            />
            <button
              onClick={handleConnectionToggle}
              disabled={isLoading}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${buttonStyles} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {buttonText}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Serial Number:</span>
            <span className="text-gray-900 font-mono">
              {device.serialNumber}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Firmware:</span>
            <span className="text-gray-900">{device.firmwareVersion}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Buttons:</span>
            <span className="text-gray-900">
              {device.buttonCount} ({device.columns}×{device.rows})
            </span>
          </div>

          {lastSeenFormatted && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Last Seen:</span>
              <span className="text-gray-900">{lastSeenFormatted}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Status: {device.connected ? 'Online' : 'Offline'}
            </span>
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }
);

DeviceCard.displayName = 'DeviceCard';

export default DeviceCard;
