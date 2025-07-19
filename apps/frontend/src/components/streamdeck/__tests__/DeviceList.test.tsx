import { render } from '@testing-library/react';
import DeviceList from '../DeviceList';

// Mock the hooks
jest.mock('../../../hooks/useDevices', () => ({
  useDevices: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../../hooks/useRealTimeEvents', () => ({
  useRealTimeEvents: () => {},
}));

describe('DeviceList', () => {
  it('renders without crashing', () => {
    const { container } = render(<DeviceList />);
    expect(container).toBeTruthy();
  });
});
