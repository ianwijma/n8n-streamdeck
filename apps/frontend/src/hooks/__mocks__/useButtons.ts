// Mock data for Storybook
const mockButtons = [
  {
    id: 'test-button-1',
    deviceId: 'test-device-1',
    position: 0,
    title: 'Webhook Button',
    icon: null,
    backgroundColor: '#3b82f6',
    textColor: '#ffffff',
    fontSize: 12,
    action: {
      type: 'webhook',
      config: {
        url: 'https://api.example.com/test',
        method: 'POST',
      },
    },
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'test-button-2',
    deviceId: 'test-device-1',
    position: 1,
    title: 'N8N Workflow',
    icon: null,
    backgroundColor: '#10b981',
    textColor: '#ffffff',
    fontSize: 12,
    action: {
      type: 'n8n-workflow',
      config: {
        workflowId: 'workflow-123',
        webhookUrl: 'https://n8n.example.com/webhook/workflow-123',
      },
    },
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'test-button-3',
    deviceId: 'test-device-1',
    position: 4,
    title: 'Disabled Button',
    icon: null,
    backgroundColor: '#6b7280',
    textColor: '#ffffff',
    fontSize: 12,
    action: {
      type: 'webhook',
      config: {
        url: 'https://api.example.com/disabled',
        method: 'POST',
      },
    },
    enabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Mock hooks for Storybook with realistic data
export const useButtons = (deviceId: string) => {
  // Always return buttons for the mock device, regardless of deviceId
  const filteredButtons = deviceId
    ? mockButtons.filter(
        (button) =>
          button.deviceId === deviceId || button.deviceId === 'test-device-1'
      )
    : mockButtons;

  return {
    data: filteredButtons,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
};

export const useUpdateButton = () => ({
  mutateAsync: (data: any) => {
    console.log('Mock: Updating button', data);
    return Promise.resolve({ ...data, updatedAt: new Date().toISOString() });
  },
  isPending: false,
});

export const useDeleteButton = () => ({
  mutateAsync: (buttonId: string) => {
    console.log('Mock: Deleting button', buttonId);
    return Promise.resolve();
  },
  isPending: false,
});

export const useCreateButton = () => ({
  mutateAsync: (data: any) => {
    console.log('Mock: Creating button', data);
    return Promise.resolve({
      ...data,
      id: `button-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },
  isPending: false,
});
