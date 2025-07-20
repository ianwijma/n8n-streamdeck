'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// Disable static generation for this page
export const dynamic = 'force-dynamic';
import { DeviceResponse, ButtonResponse } from '@/types/api';
import DeviceList from '@/components/streamdeck/DeviceList';
import ButtonGridContainer from '@/components/streamdeck/ButtonGridContainer';
import ButtonEditor from '@/components/streamdeck/ButtonEditor';
import Button from '@/components/ui/Button';
import { useButtons } from '@/hooks/useButtons';

export default function DevicesPage() {
  const { isAuthenticated, setupRequired, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (setupRequired) {
        router.push('/setup');
      } else if (!isAuthenticated) {
        router.push('/login');
      }
    }
  }, [isAuthenticated, setupRequired, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (setupRequired || !isAuthenticated) {
    return null;
  }
  const [selectedDevice, setSelectedDevice] = useState<DeviceResponse | null>(
    null
  );
  const [editingButton, setEditingButton] = useState<{
    button: ButtonResponse | null;
    position: number;
  } | null>(null);

  // Fetch buttons for the selected device (for refetching after editor closes)
  const { refetch: refetchButtons } = useButtons(selectedDevice?.id || '');

  const handleDeviceSelect = (device: DeviceResponse) => {
    setSelectedDevice(device);
  };

  const handleButtonClick = (
    button: ButtonResponse | null,
    position: number
  ) => {
    setEditingButton({ button, position });
  };

  const handleCloseEditor = () => {
    setEditingButton(null);
    // Refetch buttons after closing editor to get updated data
    refetchButtons();
  };

  const handleBackToDevices = () => {
    setSelectedDevice(null);
  };

  return (
    <div className="space-y-6">
      {!selectedDevice ? (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your StreamDeck devices and configure buttons
            </p>
          </div>
          <DeviceList onDeviceSelect={handleDeviceSelect} />
        </>
      ) : (
        <>
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
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedDevice.name}
              </h1>
              <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                <span>{selectedDevice.model}</span>
                <span>•</span>
                <span>
                  {selectedDevice.buttonCount} buttons ({selectedDevice.columns}
                  ×{selectedDevice.rows})
                </span>
                <span>•</span>
                <div className="flex items-center">
                  <div
                    className={`w-2 h-2 rounded-full mr-1 ${
                      selectedDevice.connected ? 'bg-green-400' : 'bg-red-400'
                    }`}
                  />
                  <span>
                    {selectedDevice.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ButtonGridContainer
                device={selectedDevice}
                onButtonClick={handleButtonClick}
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
                      {selectedDevice.serialNumber}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Firmware:</span>
                    <span className="text-gray-900">
                      {selectedDevice.firmwareVersion}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Layout:</span>
                    <span className="text-gray-900">
                      {selectedDevice.columns}×{selectedDevice.rows}
                    </span>
                  </div>
                  {selectedDevice.lastSeen && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Last Seen:</span>
                      <span className="text-gray-900">
                        {new Date(selectedDevice.lastSeen).toLocaleString()}
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
        </>
      )}

      {editingButton && selectedDevice && (
        <ButtonEditor
          deviceId={selectedDevice.id}
          button={editingButton.button}
          position={editingButton.position}
          onClose={handleCloseEditor}
          onSave={(button) => {
            console.log('Button saved:', button);
            // Refetch buttons to update the grid
            refetchButtons();
          }}
        />
      )}
    </div>
  );
}
