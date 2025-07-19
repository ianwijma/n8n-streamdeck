import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Decorator } from '@storybook/react';

// Create a decorator for React Query
export const withQueryClient: Decorator = (Story) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  );
};

// Create a decorator for mock data context
export const withMockData: Decorator = (Story, context) => {
  // Mock hooks that components might use
  React.useEffect(() => {
    // Mock any global setup needed for stories
  }, []);

  return <Story {...context} />;
};

// Create a decorator for consistent styling
export const withContainer: Decorator = (Story) => {
  return (
    <div className="p-4 min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <Story />
      </div>
    </div>
  );
};
