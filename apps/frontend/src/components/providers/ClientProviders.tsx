'use client';

import React from 'react';
import Layout from '@/components/ui/Layout';
import QueryProvider from '@/components/providers/QueryProvider';
import { AuthProvider } from '@/contexts/AuthContext';

interface ClientProvidersProps {
  children: React.ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <AuthProvider>
      <QueryProvider>
        <Layout>{children}</Layout>
      </QueryProvider>
    </AuthProvider>
  );
}
