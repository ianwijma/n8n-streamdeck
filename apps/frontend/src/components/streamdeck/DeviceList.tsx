'use client';

import React from 'react';
import { DeviceResponse } from '@/types/api';
import { useDevices } from '@/hooks/useDevices';
import { useRealTimeEvents } from '@/hooks/useRealTimeEvents';
import DeviceCard from './DeviceCard';

interface DeviceListProps {
  onDeviceSelect?: (device: DeviceResponse) => void;
  className?: string;
}

export default function DeviceList({
  onDeviceSelect,
  className = '',
}: DeviceListProps) {
  const { data: devices, isLoading, error, refetch } = useDevices();

  useRealTimeEvents({
    onDeviceConnected: (deviceId) => {
      console.log(`Device connected: ${deviceId}`);
    },
    onDeviceDisconnected: (deviceId) => {
      console.log(`Device disconnected: ${deviceId}`);
    },
  });

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            StreamDeck Devices
          </h2>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-6 animate-pulse"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
                <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    // For testing purposes, show mock device when API fails
    const mockDevices = [
      {
        id: 'streamdeck-test-123',
        name: 'StreamDeck XL (Mock)',
        model: 'StreamDeck XL',
        serialNumber: 'TEST123',
        firmwareVersion: '1.0.0',
        buttonCount: 32,
        columns: 8,
        rows: 4,
        connected: true,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            StreamDeck Devices
          </h2>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-orange-600">
              API Error - Showing Mock Data
            </div>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Mock Devices (for testing routing)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onClick={onDeviceSelect}
              />
            ))}
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-red-400 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">
                API Connection Failed
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {error instanceof Error
                  ? error.message
                  : 'An unexpected error occurred'}
                . Using mock data for testing.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const connectedDevices = devices?.filter((device) => device.connected) || [];
  const disconnectedDevices =
    devices?.filter((device) => !device.connected) || [];

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          StreamDeck Devices
        </h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            {connectedDevices.length} connected, {disconnectedDevices.length}{' '}
            offline
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {!devices || devices.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No devices found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Connect a StreamDeck device to get started.
          </p>
        </div>
      ) : (
        <>
          {connectedDevices.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Connected Devices
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {connectedDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onClick={onDeviceSelect}
                  />
                ))}
              </div>
            </div>
          )}

          {disconnectedDevices.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Offline Devices
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {disconnectedDevices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onClick={onDeviceSelect}
                    className="opacity-75"
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
