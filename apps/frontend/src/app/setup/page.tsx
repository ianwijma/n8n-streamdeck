'use client';

import { SetupWizard } from '@/components/auth/SetupWizard';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SetupPage() {
  const { setupRequired, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!setupRequired) {
        if (isAuthenticated) {
          router.push('/');
        } else {
          router.push('/login');
        }
      }
    }
  }, [setupRequired, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!setupRequired) {
    return null;
  }

  return (
    <SetupWizard
      onSuccess={() => {
        router.push('/');
      }}
    />
  );
}
