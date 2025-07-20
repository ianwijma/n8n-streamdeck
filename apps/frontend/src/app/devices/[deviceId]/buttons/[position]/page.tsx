'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useDevices } from '@/hooks/useDevices';
import { useButtons } from '@/hooks/useButtons';
import ButtonEditorPage from '@/components/streamdeck/ButtonEditorPage';
import { ButtonResponse } from '@/types/api';

export default function ButtonConfigurationPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params?.deviceId as string;
  const position = parseInt(params?.position as string, 10);

  const { data: devices, isLoading: devicesLoading } = useDevices();
  const { data: buttons, isLoading: buttonsLoading } = useButtons(deviceId);

  const device = devices?.find((d) => d.id === deviceId);
  const button = buttons?.find((b) => b.position === position);

  const handleClose = () => {
    router.push(`/devices/${deviceId}`);
  };

  const handleSave = (savedButton: ButtonResponse) => {
    router.push(`/devices/${deviceId}?modified=${position}`);
  };

  if (devicesLoading || buttonsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading button configuration...</p>
        </div>
      </div>
    );
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

  if (isNaN(position) || position < 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Invalid Position
          </h1>
          <p className="text-gray-600 mb-6">The button position is invalid.</p>
          <button
            onClick={() => router.push(`/devices/${deviceId}`)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Device
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-gray-500">
            <button
              onClick={() => router.push('/devices')}
              className="hover:text-gray-700"
            >
              Devices
            </button>
            <span>/</span>
            <button
              onClick={() => router.push(`/devices/${deviceId}`)}
              className="hover:text-gray-700"
            >
              {device.name}
            </button>
            <span>/</span>
            <span className="text-gray-900">
              Button {position + 1} Configuration
            </span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">
            Configure Button {position + 1}
          </h1>
          <p className="text-gray-600 mt-2">
            Configure the appearance of button {position + 1} on {device.name}.
            N8N workflows are configured from within N8N using the StreamDeck
            node.
          </p>
        </div>

        <ButtonEditorPage
          deviceId={deviceId}
          button={button || null}
          position={position}
          onClose={handleClose}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
