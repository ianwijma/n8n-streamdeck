'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logError, reportError } from '../../services/errorReporting';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
  context?: Record<string, any>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 */
export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    this.setState({ errorInfo });

    // Create error context
    const errorContext = {
      ...this.props.context,
      level: this.props.level || 'component',
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
      retryCount: this.retryCount,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Log error locally
    logError(error, errorContext);

    // Report error to backend
    reportError(error, errorContext);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Context:', errorContext);
      console.groupEnd();
    }
  }

  handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI based on level
      return this.renderDefaultFallback();
    }

    return this.props.children;
  }

  private renderDefaultFallback() {
    const { level = 'component' } = this.props;
    const { error, errorId } = this.state;
    const canRetry = this.retryCount < this.maxRetries;

    if (level === 'critical') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Critical Application Error
                </h3>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                A critical error has occurred that prevents the application from
                functioning properly. Please reload the page or contact support
                if the problem persists.
              </p>
              {process.env.NODE_ENV === 'development' && error && (
                <details className="mt-4">
                  <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {error.message}
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Reload Page
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Go Home
              </button>
            </div>
            {errorId && (
              <p className="mt-4 text-xs text-gray-500 text-center">
                Error ID: {errorId}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (level === 'page') {
      return (
        <div className="min-h-96 flex items-center justify-center">
          <div className="max-w-sm w-full bg-white border border-red-200 rounded-lg p-6">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Page Error
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Something went wrong while loading this page.
              </p>
              <div className="mt-6 flex space-x-3">
                {canRetry && (
                  <button
                    onClick={this.handleRetry}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Try Again ({this.maxRetries - this.retryCount} left)
                  </button>
                )}
                <button
                  onClick={this.handleReload}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Component level error
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">
              Component Error
            </h3>
            <p className="mt-1 text-sm text-red-700">
              This component encountered an error and couldn't render properly.
            </p>
            {canRetry && (
              <div className="mt-3">
                <button
                  onClick={this.handleRetry}
                  className="bg-red-100 text-red-800 px-3 py-1 rounded-md text-sm font-medium hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Retry ({this.maxRetries - this.retryCount} left)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Higher-order component for wrapping components with error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback(
    (error: Error, context?: Record<string, any>) => {
      // Log error
      logError(error, {
        ...context,
        component: 'useErrorHandler',
        timestamp: new Date().toISOString(),
      });

      // Report error
      reportError(error, context);

      // Set error state to trigger error boundary
      setError(error);
    },
    []
  );

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  // Throw error to trigger error boundary
  if (error) {
    throw error;
  }

  return { handleError, clearError };
}

/**
 * Specialized error boundaries for different use cases
 */

// Route-level error boundary
export const RouteErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    level="page"
    context={{ type: 'route' }}
    onError={(error, errorInfo) => {
      // Additional route-specific error handling
      console.error('Route error:', error, errorInfo);
    }}
  >
    {children}
  </ErrorBoundary>
);

// Component-level error boundary
export const ComponentErrorBoundary: React.FC<{
  children: ReactNode;
  componentName?: string;
}> = ({ children, componentName }) => (
  <ErrorBoundary
    level="component"
    context={{ type: 'component', componentName }}
  >
    {children}
  </ErrorBoundary>
);

// Critical error boundary for the entire app
export const AppErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    level="critical"
    context={{ type: 'app' }}
    onError={(error, errorInfo) => {
      // Critical error handling - might want to send to monitoring service
      console.error('Critical app error:', error, errorInfo);

      // Could trigger additional alerts or notifications
      if (
        typeof window !== 'undefined' &&
        'navigator' in window &&
        'sendBeacon' in navigator
      ) {
        navigator.sendBeacon(
          '/api/errors/critical',
          JSON.stringify({
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
          })
        );
      }
    }}
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;
