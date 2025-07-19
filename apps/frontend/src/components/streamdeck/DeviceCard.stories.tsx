import type { Meta, StoryObj } from '@storybook/react';
import DeviceCard from './DeviceCard';
import { mockDevice, mockDisconnectedDevice } from '../../tests/mocks';

// Mock the hooks used by DeviceCard
jest.mock('../../hooks/useDevices', () => ({
  useConnectDevice: () => ({
    mutateAsync: () => Promise.resolve(),
    isPending: false,
  }),
  useDisconnectDevice: () => ({
    mutateAsync: () => Promise.resolve(),
    isPending: false,
  }),
}));

const meta: Meta<typeof DeviceCard> = {
  title: 'StreamDeck/DeviceCard',
  component: DeviceCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A card component that displays StreamDeck device information with connection controls.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    device: {
      description: 'Device data object containing all device information',
      control: { type: 'object' },
    },
    onClick: {
      description: 'Callback function called when the device card is clicked',
    },
    className: {
      description: 'Additional CSS classes to apply to the card',
      control: { type: 'text' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default connected device
export const Default: Story = {
  args: {
    device: mockDevice,
    onClick: () => console.log('device-clicked'),
  },
};

// Connected device with custom styling
export const Connected: Story = {
  args: {
    device: {
      ...mockDevice,
      name: 'Production StreamDeck',
      model: 'Stream Deck XL',
      buttonCount: 32,
      columns: 8,
      rows: 4,
    },
    onClick: () => console.log('device-clicked'),
    className: 'border-green-200',
  },
  parameters: {
    docs: {
      description: {
        story:
          'A connected StreamDeck device showing all available information and controls.',
      },
    },
  },
};

// Disconnected device
export const Disconnected: Story = {
  args: {
    device: {
      ...mockDisconnectedDevice,
      name: 'Offline StreamDeck',
      lastSeen: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    },
    onClick: () => console.log('device-clicked'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'A disconnected StreamDeck device showing offline status and last seen time.',
      },
    },
  },
};

// Device with long name (testing text overflow)
export const LongName: Story = {
  args: {
    device: {
      ...mockDevice,
      name: 'StreamDeck with a Very Long Name That Should Be Truncated Properly',
      model: 'Stream Deck MK.2 Professional Edition',
    },
    onClick: () => console.log('device-clicked'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Testing how the component handles long device names and model names.',
      },
    },
  },
};

// Mini StreamDeck
export const MiniDevice: Story = {
  args: {
    device: {
      ...mockDevice,
      name: 'Mini StreamDeck',
      model: 'Stream Deck Mini',
      buttonCount: 6,
      columns: 3,
      rows: 2,
    },
    onClick: () => console.log('device-clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A smaller StreamDeck Mini device with fewer buttons.',
      },
    },
  },
};

// XL StreamDeck
export const XLDevice: Story = {
  args: {
    device: {
      ...mockDevice,
      name: 'XL StreamDeck',
      model: 'Stream Deck XL',
      buttonCount: 32,
      columns: 8,
      rows: 4,
    },
    onClick: () => console.log('device-clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A larger StreamDeck XL device with more buttons.',
      },
    },
  },
};

// Device without last seen (never connected)
export const NeverConnected: Story = {
  args: {
    device: {
      ...mockDisconnectedDevice,
      name: 'New StreamDeck',
      lastSeen: undefined,
    },
    onClick: () => console.log('device-clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'A device that has never been connected before.',
      },
    },
  },
};

// Interactive example with all states
export const Interactive: Story = {
  args: {
    device: mockDevice,
    onClick: () => console.log('device-clicked'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive example where you can modify all device properties using controls.',
      },
    },
  },
};
