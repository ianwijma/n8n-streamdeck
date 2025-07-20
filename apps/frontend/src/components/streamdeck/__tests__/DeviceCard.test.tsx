import { render, screen, fireEvent } from '@testing-library/react';
import DeviceCard from '../DeviceCard';
import { mockDevice, mockDisconnectedDevice } from '../../../tests/mocks';

// Mock the hooks
jest.mock('../../../hooks/useDevices', () => ({
  useConnectDevice: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useDisconnectDevice: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

describe('DeviceCard', () => {
  it('renders device information correctly', () => {
    render(<DeviceCard device={mockDevice} />);

    expect(screen.getByText('Test StreamDeck')).toBeTruthy();
    expect(screen.getByText('Stream Deck MK.2')).toBeTruthy();
    expect(screen.getByText('SD123456789')).toBeTruthy();
  });

  it('shows connected status for connected device', () => {
    render(<DeviceCard device={mockDevice} />);

    expect(screen.getByText(/Online/)).toBeTruthy();
  });

  it('shows disconnected status for disconnected device', () => {
    render(<DeviceCard device={mockDisconnectedDevice} />);

    expect(screen.getByText(/Offline/)).toBeTruthy();
  });

  it('calls onClick when device is clicked', () => {
    const onClick = jest.fn();
    render(<DeviceCard device={mockDevice} onClick={onClick} />);

    fireEvent.click(screen.getByText('Test StreamDeck'));
    expect(onClick).toHaveBeenCalledWith(mockDevice);
  });
  it('displays button count correctly', () => {
    render(<DeviceCard device={mockDevice} />);

    expect(screen.getByText('15 (5×3)')).toBeTruthy();
  });

  it('shows device layout information', () => {
    render(<DeviceCard device={mockDevice} />);

    expect(screen.getByText(/5×3/)).toBeTruthy();
  });
});
