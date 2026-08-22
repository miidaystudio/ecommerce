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
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
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
        <span className="font-mono text-2xs uppercase tracking-[0.15em] text-accent">Account</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">My account</h1>
        <p className="mt-1 text-sm text-text-secondary">Signed in as {user.email}</p>
      </div>

      <dl className="rounded-lg border border-border bg-surface p-5 text-sm shadow-card">
        <div className="flex justify-between border-b border-border py-3 first:pt-0 last:border-0 last:pb-0">
          <dt className="text-text-secondary">Name</dt>
          <dd className="font-medium text-text-primary">
            {[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}
          </dd>
        </div>
        <div className="flex justify-between border-b border-border py-3 last:border-0 last:pb-0">
          <dt className="text-text-secondary">Email</dt>
          <dd className="font-medium text-text-primary">{user.email}</dd>
        </div>
        <div className="flex justify-between py-3 last:border-0 last:pb-0">
          <dt className="text-text-secondary">Account type</dt>
          <dd className="font-medium text-text-primary">{user.role}</dd>
        </div>
      </dl>

      <Button variant="danger" onClick={onLogout} className="w-fit">
        Sign out
      </Button>
    </main>
  );
}
