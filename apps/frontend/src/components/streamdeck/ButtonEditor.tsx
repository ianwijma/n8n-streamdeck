'use client';

import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import {
  ButtonResponse,
  ButtonCreateRequest,
  ButtonUpdateRequest,
  ButtonActionResponse,
} from '@/types/api';
import {
  useUpdateButton,
  useCreateButton,
  useDeleteButton,
  useUploadButtonIcon,
} from '@/hooks/useButtons';

interface ButtonConfigForm {
  title?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  enabled: boolean;
  actionType?:
    | 'webhook'
    | 'n8n-workflow'
    | 'system-command'
    | 'hotkey'
    | 'text-input';
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  webhookHeaders?: string;
  webhookBody?: string;
  n8nWorkflowId?: string;
  n8nWebhookUrl?: string;
  n8nPayload?: string;
  systemCommand?: string;
  systemArgs?: string;
  hotkeyKeys?: string;
  textInput?: string;
}

interface ButtonEditorProps {
  deviceId: string;
  button: ButtonResponse | null;
  position: number;
  onClose: () => void;
  onSave?: (button: ButtonResponse) => void;
}

interface ButtonEditorProps {
  deviceId: string;
  button: ButtonResponse | null;
  position: number;
  onClose: () => void;
  onSave?: (button: ButtonResponse) => void;
}

export default function ButtonEditor({
  deviceId,
  button,
  position,
  onClose,
  onSave,
}: ButtonEditorProps) {
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
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ButtonConfigForm>({
    defaultValues: {
      title: button?.title || '',
      backgroundColor: button?.backgroundColor || '#000000',
      textColor: button?.textColor || '#ffffff',
      fontSize: button?.fontSize || 12,
      enabled: button?.enabled ?? true,
      actionType: button?.action?.type || 'webhook',
      webhookUrl:
        button?.action?.type === 'webhook'
          ? (button.action.config as any)?.url || ''
          : '',
      webhookMethod:
        button?.action?.type === 'webhook'
          ? (button.action.config as any)?.method || 'POST'
          : 'POST',
      webhookHeaders:
        button?.action?.type === 'webhook'
          ? JSON.stringify(
              (button.action.config as any)?.headers || {},
              null,
              2
            )
          : '{}',
      webhookBody:
        button?.action?.type === 'webhook'
          ? (button.action.config as any)?.body || ''
          : '',
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
      systemCommand:
        button?.action?.type === 'system-command'
          ? (button.action.config as any)?.command || ''
          : '',
      systemArgs:
        button?.action?.type === 'system-command'
          ? (button.action.config as any)?.args?.join(' ') || ''
          : '',
      hotkeyKeys:
        button?.action?.type === 'hotkey'
          ? (button.action.config as any)?.keys?.join('+') || ''
          : '',
      textInput:
        button?.action?.type === 'text-input'
          ? (button.action.config as any)?.text || ''
          : '',
    },
  });

  const actionType = watch('actionType');

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
    if (!data.actionType) return undefined;

    switch (data.actionType) {
      case 'webhook':
        return {
          type: 'webhook',
          config: {
            url: data.webhookUrl || '',
            method: data.webhookMethod || 'POST',
            headers: data.webhookHeaders ? JSON.parse(data.webhookHeaders) : {},
            body: data.webhookBody || '',
          },
        };
      case 'n8n-workflow':
        return {
          type: 'n8n-workflow',
          config: {
            workflowId: data.n8nWorkflowId || '',
            webhookUrl: data.n8nWebhookUrl || '',
            payload: data.n8nPayload ? JSON.parse(data.n8nPayload) : {},
          },
        };
      case 'system-command':
        return {
          type: 'system-command',
          config: {
            command: data.systemCommand || '',
            args: data.systemArgs ? data.systemArgs.split(' ') : [],
          },
        };
      case 'hotkey':
        return {
          type: 'hotkey',
          config: {
            keys: data.hotkeyKeys ? data.hotkeyKeys.split('+') : [],
            modifiers: [],
          },
        };
      case 'text-input':
        return {
          type: 'text-input',
          config: {
            text: data.textInput || '',
          },
        };
      default:
        return undefined;
    }
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">
              {button ? 'Edit Button' : 'Create Button'} - Position{' '}
              {position + 1}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Basic Settings */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">
              Appearance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Background Color
                </label>
                <input
                  {...register('backgroundColor')}
                  type="color"
                  className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Text Color
                </label>
                <input
                  {...register('textColor')}
                  type="color"
                  className="w-full h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Icon
              </label>
              <div className="flex items-center space-x-4">
                {iconPreview && (
                  <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                    <img
                      src={iconPreview}
                      alt="Icon preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100"
                >
                  {iconPreview ? 'Change Icon' : 'Upload Icon'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleIconUpload}
                  className="hidden"
                />
              </div>
            </div>

            <div className="mt-4">
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

          {/* Action Configuration */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Action</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action Type
                </label>
                <select
                  {...register('actionType')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">No Action</option>
                  <option value="webhook">Webhook</option>
                  <option value="n8n-workflow">N8N Workflow</option>
                  <option value="system-command">System Command</option>
                  <option value="hotkey">Hotkey</option>
                  <option value="text-input">Text Input</option>
                </select>
              </div>

              {actionType === 'webhook' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL
                    </label>
                    <input
                      {...register('webhookUrl')}
                      type="url"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://example.com/webhook"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Method
                    </label>
                    <select
                      {...register('webhookMethod')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Headers (JSON)
                    </label>
                    <textarea
                      {...register('webhookHeaders')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder='{"Content-Type": "application/json"}'
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Body
                    </label>
                    <textarea
                      {...register('webhookBody')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Request body"
                    />
                  </div>
                </div>
              )}

              {actionType === 'n8n-workflow' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Workflow ID
                    </label>
                    <input
                      {...register('n8nWorkflowId')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="workflow-id"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook URL
                    </label>
                    <input
                      {...register('n8nWebhookUrl')}
                      type="url"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://n8n.example.com/webhook/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payload (JSON)
                    </label>
                    <textarea
                      {...register('n8nPayload')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder='{"key": "value"}'
                    />
                  </div>
                </div>
              )}

              {actionType === 'system-command' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Command
                    </label>
                    <input
                      {...register('systemCommand')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="ls"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Arguments
                    </label>
                    <input
                      {...register('systemArgs')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="-la /home"
                    />
                  </div>
                </div>
              )}

              {actionType === 'hotkey' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hotkey Combination
                  </label>
                  <input
                    {...register('hotkeyKeys')}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="ctrl+c"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use + to separate keys (e.g., ctrl+shift+a)
                  </p>
                </div>
              )}

              {actionType === 'text-input' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Text to Type
                  </label>
                  <textarea
                    {...register('textInput')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Text that will be typed when button is pressed"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              {button && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteButton.isPending}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50"
                >
                  {deleteButton.isPending ? 'Deleting...' : 'Delete Button'}
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Button'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
