import type { Meta, StoryObj } from '@storybook/react';
import ButtonGrid from './ButtonGrid';
import { mockDevice } from '../../tests/mocks';

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

// Default grid with some buttons configured
export const Default: Story = {
  args: {
    device: mockDevice,
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
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

// Fully configured grid
export const FullyConfigured: Story = {
  args: {
    device: mockDevice,
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
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
    device: mockDevice,
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
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
    device: mockDevice,
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
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
    device: mockDevice,
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
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
    onButtonClick: (button, position) =>
      console.log('Button clicked:', button, position),
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
