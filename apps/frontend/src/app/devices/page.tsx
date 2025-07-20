'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// Disable static generation for this page
export const dynamic = 'force-dynamic';
import { DeviceResponse } from '@/types/api';
import DeviceList from '@/components/streamdeck/DeviceList';

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

  const handleDeviceSelect = (device: DeviceResponse) => {
    router.push(`/devices/${device.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your StreamDeck devices and configure buttons
        </p>
      </div>
      <DeviceList onDeviceSelect={handleDeviceSelect} />
    </div>
  );
}
