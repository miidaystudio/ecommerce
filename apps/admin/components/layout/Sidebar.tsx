'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/hooks/useAuth';
import { NAV_SECTIONS, type NavItem } from './nav-items';

function NavSection({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  return (
    <>
      <div className="px-5 pb-1.5 pt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-admin-sidebar-section-label">
        {label}
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
              {item.badge ? (
                <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">{item.badge}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : '··';

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-admin-sidebar-bg py-6 md:flex">
      <div className="flex items-center gap-2.5 px-5 pb-6">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-sm font-bold text-admin-sidebar-bg">
          m
        </div>
        <span className="text-[15px] font-semibold text-admin-sidebar-text-strong">miiday admin</span>
      </div>

      {NAV_SECTIONS.map((section) => (
        <NavSection key={section.label} label={section.label} items={section.items} pathname={pathname} />
      ))}

      <div className="mx-3 mt-auto border-t border-white/10 pt-4">
        <div className="flex items-center gap-2.5 px-2 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-admin-sidebar-bg">
            {initials}
          </div>
          <div>
            <div className="text-xs text-admin-sidebar-text-strong">{user?.email ?? 'Signed in'}</div>
            <div className="font-mono text-[10px] text-admin-sidebar-section-label">{user?.role ?? ''}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
