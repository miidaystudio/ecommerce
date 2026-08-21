'use client';

import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { useAuth } from '../../lib/hooks/useAuth';

export function Topbar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <span className="text-sm text-text-secondary">Ecommerce Admin</span>
      <div className="flex items-center gap-3">
        {user ? <span className="text-sm text-text-secondary">{user.email}</span> : null}
        <Button variant="danger" onClick={onLogout} className="px-3 py-1 text-xs">
          Sign out
        </Button>
      </div>
    </header>
  );
}
