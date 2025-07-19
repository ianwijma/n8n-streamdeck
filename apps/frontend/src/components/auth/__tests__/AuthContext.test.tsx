import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../../../contexts/AuthContext';
import { authService } from '../../../services/api/authService';

// Mock the auth service
jest.mock('../../../services/api/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Test component that uses the auth context
function TestComponent() {
  const {
    user,
    isAuthenticated,
    isLoading,
    setupRequired,
    error,
    login,
    logout,
    setup,
    changePassword,
    clearError,
  } = useAuth();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="authenticated">
        {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
      <div data-testid="setup-required">
        {setupRequired ? 'Setup Required' : 'Setup Complete'}
      </div>
      <div data-testid="user">{user ? user.username : 'No User'}</div>
      <div data-testid="error">{error || 'No Error'}</div>

      <button
        data-testid="login-btn"
        onClick={() => login({ username: 'admin', password: 'password' })}
      >
        Login
      </button>

      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>

      <button
        data-testid="setup-btn"
        onClick={() => setup({ username: 'admin', password: 'password' })}
      >
        Setup
      </button>

      <button
        data-testid="change-password-btn"
        onClick={() =>
          changePassword({ currentPassword: 'old', newPassword: 'new' })
        }
      >
        Change Password
      </button>

      <button data-testid="clear-error-btn" onClick={() => clearError()}>
        Clear Error
      </button>
    </div>
  );
}

function renderWithAuthProvider() {
  return render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });
    mockAuthService.getProfile.mockResolvedValue({
      id: '1',
      username: 'admin',
      role: 'admin' as any,
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      failedLoginAttempts: 0,
    });
  });

  describe('Initial State', () => {
    it('should show loading state initially', async () => {
      mockAuthService.checkSetup.mockImplementation(
        () => new Promise(() => {})
      ); // Never resolves

      renderWithAuthProvider();

      expect(screen.getByTestId('loading')).toHaveTextContent('Loading');
      expect(screen.getByTestId('authenticated')).toHaveTextContent(
        'Not Authenticated'
      );
    });

    it('should check setup status on mount', async () => {
      renderWithAuthProvider();

      await waitFor(() => {
        expect(mockAuthService.checkSetup).toHaveBeenCalled();
      });
    });
  });

  describe('Setup Flow', () => {
    it('should indicate setup is required', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: true });

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('setup-required')).toHaveTextContent(
          'Setup Required'
        );
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
      });
    });

    it('should complete setup successfully', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: true });
      mockAuthService.setup.mockResolvedValue({
        user: {
          id: '1',
          username: 'admin',
          role: 'admin' as any,
          isActive: true,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          failedLoginAttempts: 0,
        },
        expiresAt: '2024-01-01T01:00:00Z',
      });

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('setup-required')).toHaveTextContent(
          'Setup Required'
        );
      });

      await act(async () => {
        await userEvent.click(screen.getByTestId('setup-btn'));
      });

      await waitFor(() => {
        expect(mockAuthService.setup).toHaveBeenCalledWith({
          username: 'admin',
          password: 'password',
        });
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Authenticated'
        );
        expect(screen.getByTestId('user')).toHaveTextContent('admin');
        expect(screen.getByTestId('setup-required')).toHaveTextContent(
          'Setup Complete'
        );
      });
    });

    it('should handle setup errors', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: true });
      mockAuthService.setup.mockRejectedValue(new Error('Setup failed'));

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('setup-required')).toHaveTextContent(
          'Setup Required'
        );
      });

      await act(async () => {
        await userEvent.click(screen.getByTestId('setup-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Setup failed');
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should authenticate user after setup complete', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });

      renderWithAuthProvider();

      await waitFor(() => {
        expect(mockAuthService.getProfile).toHaveBeenCalled();
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Authenticated'
        );
        expect(screen.getByTestId('user')).toHaveTextContent('admin');
      });
    });

    it('should handle unauthenticated user', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });
      mockAuthService.getProfile.mockRejectedValue(new Error('Unauthorized'));

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Not Authenticated'
        );
        expect(screen.getByTestId('user')).toHaveTextContent('No User');
      });
    });

    it('should login successfully', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });
      mockAuthService.getProfile.mockRejectedValue(new Error('Unauthorized'));
      mockAuthService.login.mockResolvedValue({
        user: {
          id: '1',
          username: 'admin',
          role: 'admin' as any,
          isActive: true,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
          failedLoginAttempts: 0,
        },
        expiresAt: '2024-01-01T01:00:00Z',
      });

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Not Authenticated'
        );
      });

      await act(async () => {
        await userEvent.click(screen.getByTestId('login-btn'));
      });

      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalledWith({
          username: 'admin',
          password: 'password',
        });
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Authenticated'
        );
        expect(screen.getByTestId('user')).toHaveTextContent('admin');
      });
    });

    it('should handle login errors', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });
      mockAuthService.getProfile.mockRejectedValue(new Error('Unauthorized'));
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Not Authenticated'
        );
      });

      await act(async () => {
        await userEvent.click(screen.getByTestId('login-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Invalid credentials'
        );
      });
    });

    it('should logout successfully', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });
      mockAuthService.logout.mockResolvedValue();

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Authenticated'
        );
      });

      await act(async () => {
        await userEvent.click(screen.getByTestId('logout-btn'));
      });

      await waitFor(() => {
        expect(mockAuthService.logout).toHaveBeenCalled();
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Not Authenticated'
        );
        expect(screen.getByTestId('user')).toHaveTextContent('No User');
      });
    });
  });

  describe('Password Management', () => {
    it('should change password and logout', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });
      mockAuthService.changePassword.mockResolvedValue();
      mockAuthService.logout.mockResolvedValue();

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Authenticated'
        );
      });

      await act(async () => {
        await userEvent.click(screen.getByTestId('change-password-btn'));
      });

      await waitFor(() => {
        expect(mockAuthService.changePassword).toHaveBeenCalledWith({
          currentPassword: 'old',
          newPassword: 'new',
        });
        expect(mockAuthService.logout).toHaveBeenCalled();
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Not Authenticated'
        );
      });
    });

    it('should handle password change errors', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });
      mockAuthService.changePassword.mockRejectedValue(
        new Error('Current password is incorrect')
      );

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Authenticated'
        );
      });

      await act(async () => {
        await userEvent.click(screen.getByTestId('change-password-btn'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Current password is incorrect'
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should clear errors', async () => {
      mockAuthService.checkSetup.mockRejectedValue(
        new Error('Setup check failed')
      );

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Setup check failed'
        );
      });

      await act(async () => {
        await userEvent.click(screen.getByTestId('clear-error-btn'));
      });

      expect(screen.getByTestId('error')).toHaveTextContent('No Error');
    });

    it('should handle API response errors', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });
      mockAuthService.getProfile.mockRejectedValue({
        response: {
          data: {
            error: 'Token expired',
          },
        },
      });

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Token expired');
      });
    });
  });

  describe('Token Refresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start token refresh after authentication', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });
      mockAuthService.refreshToken.mockResolvedValue({
        expiresAt: '2024-01-01T01:00:00Z',
      });

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Authenticated'
        );
      });

      // Fast-forward 14 minutes
      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000);
      });

      await waitFor(() => {
        expect(mockAuthService.refreshToken).toHaveBeenCalled();
      });
    });

    it('should logout on refresh failure', async () => {
      mockAuthService.checkSetup.mockResolvedValue({ setupRequired: false });
      mockAuthService.refreshToken.mockRejectedValue(
        new Error('Refresh failed')
      );

      renderWithAuthProvider();

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Authenticated'
        );
      });

      // Fast-forward 14 minutes
      act(() => {
        jest.advanceTimersByTime(14 * 60 * 1000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent(
          'Not Authenticated'
        );
      });
    });
  });
});
