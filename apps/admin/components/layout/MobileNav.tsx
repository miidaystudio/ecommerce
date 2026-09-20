'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';
import { NAV_SECTIONS } from './nav-items';

/**
 * Navigation for viewports below `md`, where the sidebar is hidden.
 *
 * Without this the admin has no navigation at all on a phone — the sidebar is
 * `hidden md:flex` and the topbar carries none.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Navigating should dismiss the drawer, or it covers the page just opened.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes it, matching what a dialog is expected to do.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded border border-border text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-text-primary/40"
          />

          <aside className="relative flex w-64 max-w-[80vw] flex-col overflow-y-auto bg-admin-sidebar-bg py-6 scrollbar-none">
            <div className="flex items-center gap-2.5 px-5 pb-6">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-sm font-bold text-admin-sidebar-bg">
                m
              </div>
              <span className="text-[15px] font-semibold text-admin-sidebar-text-strong">miiday admin</span>
            </div>

            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="px-5 pb-1.5 pt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-admin-sidebar-section-label">
                  {section.label}
                </div>
                <nav className="flex flex-col gap-0.5 px-3">
                  {section.items.map((item) => {
                    const active =
                      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded px-3 py-2.5 text-sm transition ${
                          active
                            ? 'bg-admin-sidebar-active-bg text-admin-sidebar-active-text'
                            : 'text-admin-sidebar-text hover:text-admin-sidebar-text-strong'
                        }`}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}

            <div className="mx-3 mt-auto border-t border-white/10 pt-4">
              <div className="px-2 py-2.5">
                <div className="truncate text-xs text-admin-sidebar-text-strong">
                  {user?.email ?? 'Signed in'}
                </div>
                <div className="font-mono text-[10px] text-admin-sidebar-section-label">{user?.role ?? ''}</div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
