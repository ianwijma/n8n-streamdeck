import type { Preview } from '@storybook/nextjs';
import '../src/app/globals.css';
import { withQueryClient, withMockData, withContainer } from './decorators';

// Mock Socket.io to prevent WebSocket connections in Storybook
if (typeof window !== 'undefined') {
  (window as any).io = () => ({
    on: () => {},
    off: () => {},
    emit: () => {},
    disconnect: () => {},
    connected: false,
  });
}

const preview: Preview = {
  decorators: [withQueryClient, withMockData, withContainer],
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#1f2937',
        },
        {
          name: 'gray',
          value: '#f3f4f6',
        },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1024px',
            height: '768px',
          },
        },
        large: {
          name: 'Large Desktop',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
      },
    },
  },
};

export default preview;
