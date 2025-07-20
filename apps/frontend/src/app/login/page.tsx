'use client';

import { LoginForm } from '@/components/auth/LoginForm';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { isAuthenticated, setupRequired, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (setupRequired) {
        router.push('/setup');
      } else if (isAuthenticated) {
        router.push('/');
      }
    }
  }, [isAuthenticated, setupRequired, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (setupRequired || isAuthenticated) {
    return null;
  }

  return (
    <LoginForm
      onSuccess={() => {
        router.push('/');
      }}
    />
  );
}
