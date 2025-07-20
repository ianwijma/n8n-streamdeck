'use client';

import { SetupWizard } from '@/components/auth/SetupWizard';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SetupPage() {
  const { setupRequired, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [setupInProgress, setSetupInProgress] = useState(false);

  useEffect(() => {
    // Don't redirect if setup is in progress to avoid race conditions
    if (!isLoading && !setupInProgress) {
      if (!setupRequired) {
        if (isAuthenticated) {
          router.push('/');
        } else {
          router.push('/login');
        }
      }
    }
  }, [setupRequired, isAuthenticated, isLoading, setupInProgress, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!setupRequired && !setupInProgress) {
    return null;
  }

  return (
    <SetupWizard
      onSetupStart={() => setSetupInProgress(true)}
      onSuccess={() => {
        setSetupInProgress(false);
        // Small delay to ensure auth state is updated
        setTimeout(() => {
          router.push('/');
        }, 100);
      }}
      onError={() => setSetupInProgress(false)}
    />
  );
}
