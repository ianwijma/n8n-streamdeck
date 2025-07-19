'use client';

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginForm } from './LoginForm';
import { SetupWizard } from './SetupWizard';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function ProtectedRoute({
  children,
  requireAuth = true,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, setupRequired } = useAuth();

  // Show loading spinner while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show setup wizard if setup is required
  if (setupRequired) {
    return <SetupWizard />;
  }

  // Show login form if authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <LoginForm />;
  }

  // Render children if authenticated or auth is not required
  return <>{children}</>;
}

// Higher-order component for protecting pages
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options: { requireAuth?: boolean } = {}
) {
  const { requireAuth = true } = options;

  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute requireAuth={requireAuth}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
