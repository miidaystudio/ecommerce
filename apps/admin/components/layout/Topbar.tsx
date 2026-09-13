'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/hooks/useAuth';
import { MobileNav } from './MobileNav';

export function Topbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : '··';

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-background px-4 md:px-8">
      <MobileNav />

      {/* Placeholder search affordance from the reference design; hidden on
          phones where it would crowd out the account controls. */}
      <div className="hidden w-80 items-center gap-2.5 rounded bg-surface px-3.5 py-2 md:flex">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-text-secondary">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3-3" />
        </svg>
        <span className="text-sm text-text-secondary">Search orders, products, customers…</span>
        <span className="ml-auto rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
          ⌘K
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onLogout}
          className="text-xs font-medium text-text-secondary transition hover:text-danger"
        >
          Sign out
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-admin-sidebar-bg">
            {initials}
          </div>
          <span className="hidden text-sm text-text-primary sm:inline">{user?.email ?? ''}</span>
        </div>
      </div>
    </header>
  );
}
