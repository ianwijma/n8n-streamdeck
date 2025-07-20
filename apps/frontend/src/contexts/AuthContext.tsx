'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import { authService } from '../services/api/authService';
import {
  AuthState,
  AuthContextType,
  LoginRequest,
  SetupRequest,
  ChangePasswordRequest,
  User,
} from '../types/auth';

// Auth reducer actions
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_SETUP_REQUIRED'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'LOGOUT' };

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setupRequired: false,
  error: null,
};

// Auth reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null,
      };
    case 'SET_SETUP_REQUIRED':
      return {
        ...state,
        setupRequired: action.payload,
        isLoading: false,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
        setupRequired: state.setupRequired,
      };
    default:
      return state;
  }
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Token refresh interval
  const refreshInterval = React.useRef<NodeJS.Timeout | null>(null);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const handleAuthError = useCallback((error: any) => {
    let message = 'An unexpected error occurred';

    if (error?.response?.data?.error) {
      message = error.response.data.error;
    } else if (error?.message) {
      message = error.message;
    }

    dispatch({ type: 'SET_ERROR', payload: message });
  }, []);

  const checkSetup = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await authService.checkSetup();

      if (
        response &&
        typeof response === 'object' &&
        'setupRequired' in response
      ) {
        const { setupRequired } = response;
        dispatch({ type: 'SET_SETUP_REQUIRED', payload: setupRequired });

        if (!setupRequired) {
          // Try to get current user profile
          try {
            const user = await authService.getProfile();
            dispatch({ type: 'SET_USER', payload: user });
          } catch (error) {
            // User not authenticated, but setup is complete
            dispatch({ type: 'SET_USER', payload: null });
          }
        }
      } else {
        // If response is invalid, assume setup is required
        dispatch({ type: 'SET_SETUP_REQUIRED', payload: true });
      }
    } catch (error) {
      // If setup check fails, assume setup is required
      dispatch({ type: 'SET_SETUP_REQUIRED', payload: true });
      handleAuthError(error);
    }
  }, [handleAuthError]);

  const setup = useCallback(
    async (setupData: SetupRequest) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const response = await authService.setup(setupData);
        dispatch({ type: 'SET_USER', payload: response.user });
        dispatch({ type: 'SET_SETUP_REQUIRED', payload: false });

        // Start token refresh
        startTokenRefresh();
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
    [handleAuthError]
  );
  const login = useCallback(
    async (credentials: LoginRequest) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const response = await authService.login(credentials);
        dispatch({ type: 'SET_USER', payload: response.user });

        // Start token refresh
        startTokenRefresh();
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
    [handleAuthError]
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
      stopTokenRefresh();
    }
  }, []);

  const changePassword = useCallback(
    async (data: ChangePasswordRequest) => {
      try {
        await authService.changePassword(data);
        // Force logout after password change for security
        await logout();
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
    [logout, handleAuthError]
  );

  const refreshToken = useCallback(async () => {
    try {
      await authService.refreshToken();
      // Token refresh successful, continue with current user
    } catch (error) {
      console.warn('Token refresh failed:', error);
      // Force logout on refresh failure
      dispatch({ type: 'LOGOUT' });
      stopTokenRefresh();
    }
  }, []);

  const startTokenRefresh = useCallback(() => {
    stopTokenRefresh(); // Clear any existing interval

    // Refresh token every 14 minutes (1 minute before expiry)
    refreshInterval.current = setInterval(
      () => {
        refreshToken();
      },
      14 * 60 * 1000
    );
  }, [refreshToken]);

  const stopTokenRefresh = useCallback(() => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
      refreshInterval.current = null;
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const response = await authService.checkSetup();

        if (
          response &&
          typeof response === 'object' &&
          'setupRequired' in response
        ) {
          const { setupRequired } = response;
          dispatch({ type: 'SET_SETUP_REQUIRED', payload: setupRequired });

          if (!setupRequired) {
            // Try to get current user profile
            try {
              const user = await authService.getProfile();
              dispatch({ type: 'SET_USER', payload: user });
            } catch (error) {
              // User not authenticated, but setup is complete
              dispatch({ type: 'SET_USER', payload: null });
            }
          }
        } else {
          // If response is invalid, assume setup is required
          dispatch({ type: 'SET_SETUP_REQUIRED', payload: true });
        }
      } catch (error) {
        // If setup check fails, assume setup is required
        dispatch({ type: 'SET_SETUP_REQUIRED', payload: true });
        handleAuthError(error);
      }
    };

    initializeAuth();
  }, []); // Only run once on mount

  // Start token refresh if user is authenticated
  useEffect(() => {
    if (state.isAuthenticated && !state.setupRequired) {
      startTokenRefresh();
    } else {
      stopTokenRefresh();
    }

    return () => stopTokenRefresh();
  }, [
    state.isAuthenticated,
    state.setupRequired,
    startTokenRefresh,
    stopTokenRefresh,
  ]);

  // Handle visibility change to refresh token when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && state.isAuthenticated) {
        refreshToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.isAuthenticated, refreshToken]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (state.isAuthenticated) {
        refreshToken();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [state.isAuthenticated, refreshToken]);

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    setup,
    changePassword,
    refreshToken,
    checkSetup,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, setupRequired } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (setupRequired) {
      // Redirect to setup page
      return <div>Setup required</div>;
    }

    if (!isAuthenticated) {
      // Redirect to login page
      return <div>Login required</div>;
    }

    return <Component {...props} />;
  };
}
