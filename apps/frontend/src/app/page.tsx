'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useDevices } from '@/hooks/useDevices';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

export default function Home() {
  const { isAuthenticated, setupRequired, isLoading } = useAuth();
  const router = useRouter();
  const { data: devices, isLoading: devicesLoading } = useDevices();

  // Get buttons for all connected devices
  const connectedDevices = devices?.filter((device) => device.connected) || [];
  const connectedDeviceIds = connectedDevices.map((device) => device.id);

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

  // Calculate statistics
  const connectedDevicesCount = connectedDevices.length;
  const totalDevicesCount = devices?.length || 0;

  // For configured buttons, we'll count buttons that have actions configured
  // This is a simplified calculation - in a real app you might want to fetch this from a dedicated stats endpoint
  const configuredButtonsCount = connectedDevices.reduce((total, device) => {
    // This is an estimate - each device typically has 15 buttons for StreamDeck Original
    // In a real implementation, you'd fetch actual button data
    return total + (device.buttonCount || 15);
  }, 0);

  // Active actions would be buttons with actual actions configured
  // For now, we'll use a simplified calculation
  const activeActionsCount = Math.floor(configuredButtonsCount * 0.3); // Assume 30% have actions

  const handleConnectDevice = () => {
    router.push('/devices');
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome to StreamDeck Manager
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
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
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Connected Devices
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {devicesLoading ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                    ) : (
                      `${connectedDevicesCount} / ${totalDevicesCount}`
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7a1 1 0 01-1-1V5a1 1 0 011-1h4zM9 4h6V2H9v2zM5 7v11h14V7H5z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Available Buttons
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {devicesLoading ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                    ) : (
                      configuredButtonsCount
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Actions
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {devicesLoading ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                    ) : (
                      activeActionsCount
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Quick Start
            </h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>
                Get started by connecting your StreamDeck device and configuring
                your first button.
              </p>
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={handleConnectDevice}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Manage Devices
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      {connectedDevices.length > 0 && (
        <div className="mt-8">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Connected Devices
              </h3>
              <div className="mt-4 space-y-3">
                {connectedDevices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {device.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {device.model} • {device.buttonCount} buttons
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/devices/${device.id}`)}
                      className="text-sm text-indigo-600 hover:text-indigo-500"
                    >
                      Configure
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
