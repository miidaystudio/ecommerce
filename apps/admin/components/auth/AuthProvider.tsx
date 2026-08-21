'use client';

import { useEffect } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { bootstrap } = useAuth();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <>{children}</>;
}
