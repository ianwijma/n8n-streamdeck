'use client';

import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  ButtonResponse,
  ButtonCreateRequest,
  ButtonActionResponse,
} from '@/types/api';
import {
  useUpdateButton,
  useCreateButton,
  useDeleteButton,
  useUploadButtonIcon,
} from '@/hooks/useButtons';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';

interface ButtonConfigForm {
  title?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  enabled: boolean;
  n8nWorkflowId?: string;
  n8nWebhookUrl?: string;
  n8nPayload?: string;
}

interface ButtonEditorPageProps {
  deviceId: string;
  button: ButtonResponse | null;
  position: number;
  onClose: () => void;
  onSave?: (button: ButtonResponse) => void;
}

export default function ButtonEditorPage({
  deviceId,
  button,
  position,
  onClose,
  onSave,
}: ButtonEditorPageProps) {
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(
    button?.icon || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateButton = useUpdateButton();
  const createButton = useCreateButton();
  const deleteButton = useDeleteButton();
  const uploadIcon = useUploadButtonIcon();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ButtonConfigForm>({
    defaultValues: {
      title: button?.title || '',
      backgroundColor: button?.backgroundColor || '#000000',
      textColor: button?.textColor || '#ffffff',
      fontSize: button?.fontSize || 12,
      enabled: button?.enabled ?? true,
      n8nWorkflowId:
        button?.action?.type === 'n8n-workflow'
          ? (button.action.config as any)?.workflowId || ''
          : '',
      n8nWebhookUrl:
        button?.action?.type === 'n8n-workflow'
          ? (button.action.config as any)?.webhookUrl || ''
          : '',
      n8nPayload:
        button?.action?.type === 'n8n-workflow'
          ? JSON.stringify(
              (button.action.config as any)?.payload || {},
              null,
              2
            )
          : '{}',
    },
  });

  const handleIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIconFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setIconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const buildActionConfig = (
    data: ButtonConfigForm
  ): ButtonActionResponse | undefined => {
    // Always create an N8N workflow action if workflow ID is provided
    if (data.n8nWorkflowId) {
      return {
        type: 'n8n-workflow',
        config: {
          workflowId: data.n8nWorkflowId,
          webhookUrl: data.n8nWebhookUrl || '',
          payload: data.n8nPayload ? JSON.parse(data.n8nPayload) : {},
        },
      };
    }
    return undefined;
  };

  const onSubmit = async (data: ButtonConfigForm) => {
    try {
      const config: ButtonCreateRequest = {
        position,
        title: data.title,
        backgroundColor: data.backgroundColor,
        textColor: data.textColor,
        fontSize: data.fontSize,
        enabled: data.enabled,
        action: buildActionConfig(data),
      };

      let savedButton: ButtonResponse;

      if (button) {
        savedButton = await updateButton.mutateAsync({
          deviceId,
          buttonId: button.id,
          config,
        });
      } else {
        savedButton = await createButton.mutateAsync({
          deviceId,
          config,
        });
      }

      if (iconFile) {
        await uploadIcon.mutateAsync({
          deviceId,
          buttonId: savedButton.id,
          file: iconFile,
        });
      }

      onSave?.(savedButton);
      onClose();
    } catch (error) {
      console.error('Failed to save button:', error);
    }
  };

  const handleDelete = async () => {
    if (
      button &&
      window.confirm('Are you sure you want to delete this button?')
    ) {
      try {
        await deleteButton.mutateAsync({
          deviceId,
          buttonId: button.id,
        });
        onClose();
      } catch (error) {
        console.error('Failed to delete button:', error);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">Appearance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                {...register('title')}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Button title"
              />
              {errors.title && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Font Size
              </label>
              <input
                {...register('fontSize', { valueAsNumber: true })}
                type="number"
                min="8"
                max="24"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background Color
              </label>
              <input
                {...register('backgroundColor')}
                type="color"
                className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Text Color
              </label>
              <input
                {...register('textColor')}
                type="color"
                className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Icon
            </label>
            <div className="flex items-center space-x-4">
              {iconPreview && (
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Icon src={iconPreview} alt="Icon preview" size="lg" />
                </div>
              )}
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="ghost"
                size="sm"
                className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
              >
                {iconPreview ? 'Change Icon' : 'Upload Icon'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleIconUpload}
                className="hidden"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="flex items-center">
              <input
                {...register('enabled')}
                type="checkbox"
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700">Enabled</span>
            </label>
          </div>
        </div>

        {/* N8N Workflow Configuration */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">
            N8N Workflow
          </h3>
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    StreamDeck Button → N8N Workflow
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Configure this button to trigger an N8N workflow when
                    pressed. You'll need the workflow ID and webhook URL from
                    your N8N instance.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workflow ID <span className="text-red-500">*</span>
              </label>
              <input
                {...register('n8nWorkflowId', {
                  required: 'Workflow ID is required',
                })}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., 123 or my-workflow-name"
              />
              {errors.n8nWorkflowId && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.n8nWorkflowId.message}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                The unique identifier for your N8N workflow
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook URL <span className="text-red-500">*</span>
              </label>
              <input
                {...register('n8nWebhookUrl', {
                  required: 'Webhook URL is required',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: 'Please enter a valid URL',
                  },
                })}
                type="url"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://your-n8n-instance.com/webhook/streamdeck-trigger"
              />
              {errors.n8nWebhookUrl && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.n8nWebhookUrl.message}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                The webhook URL that will trigger your N8N workflow
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payload (JSON)
              </label>
              <textarea
                {...register('n8nPayload')}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                placeholder='{"deviceId": "streamdeck-001", "buttonPosition": 1, "timestamp": "2024-01-01T00:00:00Z"}'
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional JSON payload to send with the webhook request. Leave
                empty for default payload.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              {button && (
                <Button
                  type="button"
                  onClick={handleDelete}
                  loading={deleteButton.isPending}
                  variant="danger"
                  size="sm"
                >
                  {deleteButton.isPending ? 'Deleting...' : 'Delete Button'}
                </Button>
              )}
            </div>
            <div className="flex space-x-3">
              <Button
                type="button"
                onClick={onClose}
                variant="secondary"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmitting}
                variant="primary"
                size="sm"
              >
                {isSubmitting ? 'Saving...' : 'Save Button'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
