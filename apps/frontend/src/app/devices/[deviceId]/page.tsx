'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useParams, useSearchParams } from 'next/navigation';
import { useDevices } from '@/hooks/useDevices';
import { ButtonResponse } from '@/types/api';
import ButtonGridContainer from '@/components/streamdeck/ButtonGridContainer';
import Button from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export default function DevicePage() {
  const { isAuthenticated, setupRequired, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const deviceId = params?.deviceId as string;

  const [recentlyModifiedPosition, setRecentlyModifiedPosition] = useState<
    number | undefined
  >();

  const { data: devices, isLoading: devicesLoading } = useDevices();
  const device = devices?.find((d) => d.id === deviceId);

  // Check if we're returning from button configuration
  useEffect(() => {
    if (searchParams) {
      const modifiedPosition = searchParams.get('modified');
      if (modifiedPosition !== null) {
        const position = parseInt(modifiedPosition, 10);
        if (!isNaN(position)) {
          setRecentlyModifiedPosition(position);
          // Clear the URL parameter
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('modified');
          window.history.replaceState({}, '', newUrl.toString());
        }
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoading) {
      if (setupRequired) {
        router.push('/setup');
      } else if (!isAuthenticated) {
        router.push('/login');
      }
    }
  }, [isAuthenticated, setupRequired, isLoading, router]);

  if (isLoading || devicesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (setupRequired || !isAuthenticated) {
    return null;
  }

  if (!device) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Device Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            The requested device could not be found.
          </p>
          <button
            onClick={() => router.push('/devices')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Devices
          </button>
        </div>
      </div>
    );
  }

  const handleButtonClick = (
    button: ButtonResponse | null,
    position: number
  ) => {
    router.push(`/devices/${deviceId}/buttons/${position}`);
  };

  const handleBackToDevices = () => {
    router.push('/devices');
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBackToDevices}
            className="flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <svg
              className="w-5 h-5 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Devices
          </button>
        </div>
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-gray-900">{device.name}</h1>
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
            <span>{device.model}</span>
            <span>•</span>
            <span>
              {device.buttonCount} buttons ({device.columns}×{device.rows})
            </span>
            <span>•</span>
            <div className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-1 ${
                  device.connected ? 'bg-green-400' : 'bg-red-400'
                }`}
              />
              <span>{device.connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <ButtonGridContainer
            device={device}
            onButtonClick={handleButtonClick}
            recentlyModifiedPosition={recentlyModifiedPosition}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Device Info
            </h3>
            <div className="space-y-3">
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
                <span className="text-gray-500">Layout:</span>
                <span className="text-gray-900">
                  {device.columns}×{device.rows}
                </span>
              </div>
              {device.lastSeen && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Last Seen:</span>
                  <span className="text-gray-900">
                    {new Date(device.lastSeen).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <Button variant="primary" size="sm" className="w-full">
                Reset All Buttons
              </Button>
              <Button variant="secondary" size="sm" className="w-full">
                Export Configuration
              </Button>
              <Button variant="secondary" size="sm" className="w-full">
                Import Configuration
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex">
              <svg
                className="w-5 h-5 text-blue-400 mr-3 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-blue-800">Tips</h4>
                <div className="mt-1 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Click any button to configure it</li>
                    <li>Drag buttons to reorder them</li>
                    <li>Use webhooks to trigger N8N workflows</li>
                    <li>Upload custom icons for better visibility</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
