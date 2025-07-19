import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ButtonGrid from '../ButtonGrid';
import { mockDevice } from '../../../tests/mocks';

// Mock the hooks
jest.mock('../../../hooks/useButtons', () => ({
  useButtons: jest.fn(),
  useUpdateButton: jest.fn(),
}));

jest.mock('../../../hooks/useRealTimeEvents', () => ({
  useRealTimeEvents: jest.fn(),
}));

const mockUseButtons = require('../../../hooks/useButtons').useButtons;
const mockUseUpdateButton =
  require('../../../hooks/useButtons').useUpdateButton;
const mockUseRealTimeEvents =
  require('../../../hooks/useRealTimeEvents').useRealTimeEvents;

const mockButtons = [
  {
    id: 'test-button-1',
    deviceId: 'test-device-1',
    position: 0,
    title: 'Test Button 1',
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
    title: 'Test Button 2',
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
];

const renderWithQueryClient = (component: React.ReactElement) => {
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

  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  );
};

describe('ButtonGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseUpdateButton.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
      isPending: false,
    });

    mockUseRealTimeEvents.mockReturnValue({});
  });

  it('shows loading state when buttons are loading', () => {
    mockUseButtons.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWithQueryClient(<ButtonGrid device={mockDevice} />);

    expect(screen.getByText('Loading buttons...')).toBeInTheDocument();
    expect(screen.getByText('Button Configuration')).toBeInTheDocument();
  });

  it('shows error state when there is an error', () => {
    const error = new Error('Failed to load buttons');
    mockUseButtons.mockReturnValue({
      data: undefined,
      isLoading: false,
      error,
    });

    renderWithQueryClient(<ButtonGrid device={mockDevice} />);

    expect(screen.getByText('Failed to load buttons')).toBeInTheDocument();
    expect(screen.getByText('Failed to load buttons')).toBeInTheDocument();
  });

  it('renders buttons when data is loaded', async () => {
    mockUseButtons.mockReturnValue({
      data: mockButtons,
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<ButtonGrid device={mockDevice} />);

    await waitFor(() => {
      expect(screen.getByText('Test Button 1')).toBeInTheDocument();
      expect(screen.getByText('Test Button 2')).toBeInTheDocument();
    });

    // Should show button configuration header
    expect(screen.getByText('Button Configuration')).toBeInTheDocument();
    expect(
      screen.getByText('Click a button to configure it, or drag to reorder')
    ).toBeInTheDocument();
  });

  it('renders empty slots for buttons that are not configured', async () => {
    mockUseButtons.mockReturnValue({
      data: [mockButtons[0]], // Only one button
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<ButtonGrid device={mockDevice} />);

    await waitFor(() => {
      expect(screen.getByText('Test Button 1')).toBeInTheDocument();
    });

    // Should have empty slots (device has 15 buttons, we only have 1 configured)
    const emptySlots = screen.getAllByText('Empty');
    expect(emptySlots).toHaveLength(14); // 15 total - 1 configured = 14 empty
  });

  it('calls useButtons with correct device ID', () => {
    mockUseButtons.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<ButtonGrid device={mockDevice} />);

    expect(mockUseButtons).toHaveBeenCalledWith(mockDevice.id);
  });

  it('calls onButtonClick when a button is clicked', async () => {
    const onButtonClick = jest.fn();
    mockUseButtons.mockReturnValue({
      data: mockButtons,
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(
      <ButtonGrid device={mockDevice} onButtonClick={onButtonClick} />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Button 1')).toBeInTheDocument();
    });

    // Click the first button
    const button1 = screen.getByText('Test Button 1').closest('div');
    if (button1) {
      button1.click();
      expect(onButtonClick).toHaveBeenCalledWith(mockButtons[0], 0);
    }
  });

  it('shows position numbers on buttons', async () => {
    mockUseButtons.mockReturnValue({
      data: mockButtons,
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<ButtonGrid device={mockDevice} />);

    await waitFor(() => {
      // Position numbers start from 1 (position 0 shows as "1")
      expect(screen.getByText('1')).toBeInTheDocument(); // Button at position 0
      expect(screen.getByText('2')).toBeInTheDocument(); // Button at position 1
    });
  });

  it('handles disabled buttons correctly', async () => {
    const disabledButton = {
      ...mockButtons[0],
      enabled: false,
    };

    mockUseButtons.mockReturnValue({
      data: [disabledButton],
      isLoading: false,
      error: null,
    });

    renderWithQueryClient(<ButtonGrid device={mockDevice} />);

    await waitFor(() => {
      expect(screen.getByText('Test Button 1')).toBeInTheDocument();
    });

    // Should show disabled overlay (X icon)
    const disabledIcon = screen.getByRole('img', { hidden: true });
    expect(disabledIcon).toBeInTheDocument();
  });
});
