import type { Meta, StoryObj } from '@storybook/react';
import ButtonGrid from './ButtonGrid';
import { mockButtons, mockDevice } from '../../tests/mocks';

// Mock the hooks used by ButtonGrid
jest.mock('../../hooks/useButtons', () => ({
  useButtons: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useUpdateButton: () => ({
    mutateAsync: () => Promise.resolve(),
    isPending: false,
  }),
  useDeleteButton: () => ({
    mutateAsync: () => Promise.resolve(),
    isPending: false,
  }),
}));

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
    onButtonClick: {
      description: 'Callback when a button is clicked',
    },
    className: {
      description: 'Additional CSS classes',
      control: { type: 'text' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Empty grid (no buttons configured)
export const Empty: Story = {
  args: {
    device: mockDevice,
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
  },
  parameters: {
    docs: {
      description: {
        story:
          'An empty button grid showing placeholder slots for all button positions.',
      },
    },
  },
};

// Fully configured grid
export const FullyConfigured: Story = {
  args: {
    device: mockDevice,
    onButtonClick: (button, position) => console.log('Button clicked:', button, position),
  },
      {
        ...mockButtons[0],
        id: 'button-5',
        position: 4,
        title: 'Button 5',
        backgroundColor: '#ef4444',
      },
      {
        ...mockButtons[0],
        id: 'button-6',
        position: 5,
        title: 'Button 6',
        backgroundColor: '#10b981',
      },
      {
        ...mockButtons[0],
        id: 'button-7',
        position: 6,
        title: 'Button 7',
        backgroundColor: '#f59e0b',
      },
      {
        ...mockButtons[0],
        id: 'button-8',
        position: 7,
        title: 'Button 8',
        backgroundColor: '#8b5cf6',
      },
    ],
    rows: 3,
    columns: 5,
    onButtonClick: (position: number) =>
      console.log('Button clicked:', position),
    onButtonEdit: (position: number) => console.log('Button edit:', position),
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

// Mixed configured and empty buttons
export const Mixed: Story = {
  args: {
    deviceId: mockDevice.id,
    buttons: [
      mockButtons[0], // Position 0
      mockButtons[1], // Position 1
      // Position 2 empty
      {
        ...mockButtons[0],
        id: 'button-4',
        position: 3,
        title: 'Settings',
        backgroundColor: '#6b7280',
      },
      // Positions 4-6 empty
      {
        ...mockButtons[0],
        id: 'button-8',
        position: 7,
        title: 'Help',
        backgroundColor: '#06b6d4',
      },
    ],
    rows: 3,
    columns: 5,
    onButtonClick: (position: number) =>
      console.log('Button clicked:', position),
    onButtonEdit: (position: number) => console.log('Button edit:', position),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A button grid with some configured buttons and some empty slots, showing the typical usage pattern.',
      },
    },
  },
};

// Mini StreamDeck layout (2x3)
export const MiniLayout: Story = {
  args: {
    deviceId: mockDevice.id,
    buttons: [
      {
        ...mockButtons[0],
        position: 0,
        title: 'Mic',
        backgroundColor: '#dc2626',
      },
      {
        ...mockButtons[0],
        id: 'button-2',
        position: 1,
        title: 'Camera',
        backgroundColor: '#059669',
      },
      {
        ...mockButtons[0],
        id: 'button-3',
        position: 2,
        title: 'Screen',
        backgroundColor: '#7c3aed',
      },
    ],
    rows: 2,
    columns: 3,
    onButtonClick: (position: number) =>
      console.log('Button clicked:', position),
    onButtonEdit: (position: number) => console.log('Button edit:', position),
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
    deviceId: mockDevice.id,
    buttons: [
      {
        ...mockButtons[0],
        position: 0,
        title: 'Scene 1',
        backgroundColor: '#1f2937',
      },
      {
        ...mockButtons[0],
        id: 'button-2',
        position: 1,
        title: 'Scene 2',
        backgroundColor: '#374151',
      },
      {
        ...mockButtons[0],
        id: 'button-3',
        position: 8,
        title: 'Mic Mute',
        backgroundColor: '#dc2626',
      },
      {
        ...mockButtons[0],
        id: 'button-4',
        position: 9,
        title: 'Camera',
        backgroundColor: '#059669',
      },
      {
        ...mockButtons[0],
        id: 'button-5',
        position: 16,
        title: 'Music',
        backgroundColor: '#7c3aed',
      },
    ],
    rows: 4,
    columns: 8,
    onButtonClick: (position: number) =>
      console.log('Button clicked:', position),
    onButtonEdit: (position: number) => console.log('Button edit:', position),
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
    deviceId: mockDevice.id,
    buttons: [
      {
        ...mockButtons[0],
        enabled: true,
        title: 'Active',
        backgroundColor: '#10b981',
      },
      {
        ...mockButtons[1],
        enabled: false,
        title: 'Disabled',
        backgroundColor: '#6b7280',
      },
      {
        ...mockButtons[0],
        id: 'button-3',
        position: 2,
        enabled: true,
        title: 'Working',
        backgroundColor: '#3b82f6',
      },
    ],
    rows: 3,
    columns: 5,
    onButtonClick: (position: number) =>
      console.log('Button clicked:', position),
    onButtonEdit: (position: number) => console.log('Button edit:', position),
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
