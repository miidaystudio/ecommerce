'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../lib/hooks/useAuth';

export default function AccountPage() {
  const router = useRouter();
  const { user, status, logout } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated' || !user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Loading your account…</p>
      </main>
    );
  }

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">My account</h1>
        <p className="mt-1 text-sm text-text-secondary">Signed in as {user.email}</p>
      </div>

      <dl className="rounded-md border border-border bg-surface p-4 text-sm">
        <div className="flex justify-between py-1">
          <dt className="text-text-secondary">Name</dt>
          <dd className="text-text-primary">
            {[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}
          </dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-text-secondary">Email</dt>
          <dd className="text-text-primary">{user.email}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-text-secondary">Account type</dt>
          <dd className="text-text-primary">{user.role}</dd>
        </div>
      </dl>

      <Button variant="danger" onClick={onLogout} className="w-fit">
        Sign out
      </Button>
    </main>
  );
}
