import type { Meta, StoryObj } from '@storybook/react';
import DeviceCard from './DeviceCard';
import { mockDevice, mockDisconnectedDevice } from '../../tests/mocks';

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
    isConnecting: {
      description: 'Whether the device is currently connecting',
      control: { type: 'boolean' },
    },
    isDisconnecting: {
      description: 'Whether the device is currently disconnecting',
      control: { type: 'boolean' },
    },
    onClick: {
      description: 'Callback function called when the device card is clicked',
    },
    onConnectionToggle: {
      description: 'Callback function called when connection toggle is clicked',
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
    isConnecting: false,
    isDisconnecting: false,
    onClick: (device) => console.log('device-clicked', device),
    onConnectionToggle: async (device) =>
      console.log('connection-toggle', device),
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
    isConnecting: false,
    isDisconnecting: false,
    onClick: (device) => console.log('device-clicked', device),
    onConnectionToggle: async (device) =>
      console.log('connection-toggle', device),
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
    isConnecting: false,
    isDisconnecting: false,
    onClick: (device) => console.log('device-clicked', device),
    onConnectionToggle: async (device) =>
      console.log('connection-toggle', device),
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

// Connecting state
export const Connecting: Story = {
  args: {
    device: mockDisconnectedDevice,
    isConnecting: true,
    isDisconnecting: false,
    onClick: (device) => console.log('device-clicked', device),
    onConnectionToggle: async (device) =>
      console.log('connection-toggle', device),
  },
  parameters: {
    docs: {
      description: {
        story: 'Device in connecting state showing loading indicator.',
      },
    },
  },
};

// Disconnecting state
export const Disconnecting: Story = {
  args: {
    device: mockDevice,
    isConnecting: false,
    isDisconnecting: true,
    onClick: (device) => console.log('device-clicked', device),
    onConnectionToggle: async (device) =>
      console.log('connection-toggle', device),
  },
  parameters: {
    docs: {
      description: {
        story: 'Device in disconnecting state showing loading indicator.',
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
    isConnecting: false,
    isDisconnecting: false,
    onClick: (device) => console.log('device-clicked', device),
    onConnectionToggle: async (device) =>
      console.log('connection-toggle', device),
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
    isConnecting: false,
    isDisconnecting: false,
    onClick: (device) => console.log('device-clicked', device),
    onConnectionToggle: async (device) =>
      console.log('connection-toggle', device),
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
    isConnecting: false,
    isDisconnecting: false,
    onClick: (device) => console.log('device-clicked', device),
    onConnectionToggle: async (device) =>
      console.log('connection-toggle', device),
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
    isConnecting: false,
    isDisconnecting: false,
    onClick: (device) => console.log('device-clicked', device),
    onConnectionToggle: async (device) =>
      console.log('connection-toggle', device),
  },
  parameters: {
    docs: {
      description: {
        story: 'A device that has never been connected before.',
      },
    },
  },
};
