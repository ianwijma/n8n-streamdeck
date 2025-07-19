import type { Meta, StoryObj } from '@storybook/react';
import ButtonGrid from './ButtonGrid';
import { mockDevice, mockButtons } from '../../tests/mocks';
import { ButtonResponse } from '@/types/api';

const meta: Meta<typeof ButtonGrid> = {
  title: 'StreamDeck/ButtonGrid',
  component: ButtonGrid,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A grid component that displays StreamDeck buttons in their physical layout with drag-and-drop reordering.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    device: {
      description: 'Device object containing device information',
      control: { type: 'object' },
    },
    buttons: {
      description: 'Array of button configurations',
      control: { type: 'object' },
    },
    isLoading: {
      description: 'Loading state',
      control: { type: 'boolean' },
    },
    error: {
      description: 'Error state',
      control: { type: 'object' },
    },
    pressedButtons: {
      description: 'Set of currently pressed button positions',
      control: { type: 'object' },
    },
    onButtonClick: {
      description: 'Callback when a button is clicked',
    },
    onButtonReorder: {
      description: 'Callback when buttons are reordered',
    },
    className: {
      description: 'Additional CSS classes',
      control: { type: 'text' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Create additional mock buttons for different stories
const createMockButton = (
  id: string,
  position: number,
  title: string,
  backgroundColor: string = '#000000',
  enabled: boolean = true
): ButtonResponse => ({
  id,
  deviceId: mockDevice.id,
  position,
  title,
  icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  backgroundColor,
  textColor: '#ffffff',
  fontSize: 12,
  action: {
    type: 'webhook',
    config: {
      url: 'https://api.example.com/test',
      method: 'POST',
    } as any,
  },
  enabled,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Default grid with some buttons configured
export const Default: Story = {
  args: {
    device: mockDevice,
    buttons: mockButtons,
    isLoading: false,
    error: null,
    pressedButtons: new Set(),
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
    onButtonReorder: async (oldIndex, newIndex, oldButton, newButton) =>
      console.log('Button reorder:', {
        oldIndex,
        newIndex,
        oldButton,
        newButton,
      }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A button grid showing the default state with some configured buttons and empty slots.',
      },
    },
  },
};

// Loading state
export const Loading: Story = {
  args: {
    device: mockDevice,
    buttons: [],
    isLoading: true,
    error: null,
    pressedButtons: new Set(),
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
  },
  parameters: {
    docs: {
      description: {
        story: 'Button grid in loading state showing skeleton placeholders.',
      },
    },
  },
};

// Error state
export const ErrorState: Story = {
  args: {
    device: mockDevice,
    buttons: [],
    isLoading: false,
    error: new globalThis.Error('Failed to load buttons'),
    pressedButtons: new Set(),
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
  },
  parameters: {
    docs: {
      description: {
        story: 'Button grid showing error state when data fails to load.',
      },
    },
  },
};

// Fully configured grid
export const FullyConfigured: Story = {
  args: {
    device: mockDevice,
    buttons: [
      createMockButton('btn-1', 0, 'Webhook', '#3b82f6'),
      createMockButton('btn-2', 1, 'N8N Flow', '#10b981'),
      createMockButton('btn-3', 2, 'API Call', '#f59e0b'),
      createMockButton('btn-4', 3, 'Script', '#8b5cf6'),
      createMockButton('btn-5', 4, 'Email', '#ef4444'),
      createMockButton('btn-6', 5, 'Slack', '#06b6d4'),
      createMockButton('btn-7', 6, 'Discord', '#6366f1'),
      createMockButton('btn-8', 7, 'Teams', '#0ea5e9'),
    ],
    isLoading: false,
    error: null,
    pressedButtons: new Set(),
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
    onButtonReorder: async (oldIndex, newIndex, oldButton, newButton) =>
      console.log('Button reorder:', {
        oldIndex,
        newIndex,
        oldButton,
        newButton,
      }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A button grid with multiple configured buttons showing different colors and titles.',
      },
    },
  },
};

// Mini StreamDeck layout (2x3)
export const MiniLayout: Story = {
  args: {
    device: {
      ...mockDevice,
      buttonCount: 6,
      columns: 3,
      rows: 2,
      model: 'Stream Deck Mini',
    },
    buttons: [
      createMockButton('mini-1', 0, 'Home', '#3b82f6'),
      createMockButton('mini-2', 1, 'Work', '#10b981'),
      createMockButton('mini-3', 2, 'Music', '#f59e0b'),
    ],
    isLoading: false,
    error: null,
    pressedButtons: new Set(),
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
    onButtonReorder: async (oldIndex, newIndex, oldButton, newButton) =>
      console.log('Button reorder:', {
        oldIndex,
        newIndex,
        oldButton,
        newButton,
      }),
  },
  parameters: {
    docs: {
      description: {
        story: 'A smaller 2x3 button grid layout for StreamDeck Mini devices.',
      },
    },
  },
};

// XL StreamDeck layout (4x8)
export const XLLayout: Story = {
  args: {
    device: {
      ...mockDevice,
      buttonCount: 32,
      columns: 8,
      rows: 4,
      model: 'Stream Deck XL',
    },
    buttons: [
      createMockButton('xl-1', 0, 'Scene 1', '#3b82f6'),
      createMockButton('xl-2', 1, 'Scene 2', '#10b981'),
      createMockButton('xl-3', 8, 'Mic', '#ef4444'),
      createMockButton('xl-4', 9, 'Camera', '#f59e0b'),
      createMockButton('xl-5', 16, 'Stream', '#8b5cf6'),
      createMockButton('xl-6', 24, 'Record', '#ec4899'),
    ],
    isLoading: false,
    error: null,
    pressedButtons: new Set(),
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
    onButtonReorder: async (oldIndex, newIndex, oldButton, newButton) =>
      console.log('Button reorder:', {
        oldIndex,
        newIndex,
        oldButton,
        newButton,
      }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A larger 4x8 button grid layout for StreamDeck XL devices with strategic button placement.',
      },
    },
  },
};

// Disabled buttons
export const WithDisabledButtons: Story = {
  args: {
    device: mockDevice,
    buttons: [
      createMockButton('dis-1', 0, 'Active', '#3b82f6', true),
      createMockButton('dis-2', 1, 'Disabled', '#6b7280', false),
      createMockButton('dis-3', 2, 'Active', '#10b981', true),
      createMockButton('dis-4', 3, 'Disabled', '#6b7280', false),
    ],
    isLoading: false,
    error: null,
    pressedButtons: new Set(),
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
    onButtonReorder: async (oldIndex, newIndex, oldButton, newButton) =>
      console.log('Button reorder:', {
        oldIndex,
        newIndex,
        oldButton,
        newButton,
      }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Button grid showing both enabled and disabled buttons with different visual states.',
      },
    },
  },
};

// Pressed buttons state
export const WithPressedButtons: Story = {
  args: {
    device: mockDevice,
    buttons: [
      createMockButton('press-1', 0, 'Normal', '#3b82f6'),
      createMockButton('press-2', 1, 'Pressed', '#10b981'),
      createMockButton('press-3', 2, 'Normal', '#f59e0b'),
      createMockButton('press-4', 6, 'Pressed', '#8b5cf6'),
    ],
    isLoading: false,
    error: null,
    pressedButtons: new Set([1, 6]),
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
    onButtonReorder: async (oldIndex, newIndex, oldButton, newButton) =>
      console.log('Button reorder:', {
        oldIndex,
        newIndex,
        oldButton,
        newButton,
      }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Button grid showing pressed button states with visual feedback.',
      },
    },
  },
};
