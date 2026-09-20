'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/hooks/useAuth';
import { MobileNav } from './MobileNav';

export function Topbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'AD';

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="h-16 shrink-0 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between">
      <MobileNav />

      {/* Search Pill Bar */}
      <div className="hidden md:flex bg-neutral-100/80 border border-neutral-200/80 rounded-full px-4 py-2 text-xs font-mono text-neutral-700 w-80 items-center justify-between focus-within:bg-white focus-within:border-neutral-400 transition-all">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-neutral-400">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <span className="text-neutral-400 text-xs">Search orders, products…</span>
        </div>
        <kbd className="text-[10px] font-mono text-neutral-400 bg-neutral-200/60 px-1.5 py-0.5 rounded">⌘K</kbd>
      </div>

      {/* Right User Dock */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onLogout}
          className="text-xs font-mono text-neutral-600 hover:text-neutral-900 transition-colors uppercase tracking-wider"
        >
          Sign out
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#E5D7B7] text-[#4A3B18] font-bold text-xs flex items-center justify-center border border-neutral-300">
            {initials}
          </div>
          <span className="hidden sm:inline text-xs font-mono text-neutral-600 hover:text-neutral-900">
            {user?.email ?? 'admin@miiday.com'}
          </span>
        </div>
      </div>
    </header>
  );
}

