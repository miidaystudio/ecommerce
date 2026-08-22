'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';

type NavItem = {
  label: string;
  href: string;
  icon: ReactElement;
  badge?: string;
};

const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };

const GENERAL_NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
  {
    label: 'Products',
    href: '/products',
    icon: (
      <svg {...iconProps}>
        <path d="M20 7 12 3 4 7l8 4 8-4Z" />
        <path d="m4 7 8 4v10L4 17V7Z" />
        <path d="m20 7-8 4v10l8-4V7Z" />
      </svg>
    ),
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: (
      <svg {...iconProps}>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
      </svg>
    ),
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      </svg>
    ),
  },
  {
    label: 'Categories',
    href: '/categories',
    icon: (
      <svg {...iconProps}>
        <path d="M3 6h18M6 12h12M10 18h4" />
      </svg>
    ),
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: (
      <svg {...iconProps}>
        <path d="M20 12V8a2 2 0 0 0-2-2h-3l-2-2H9L7 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9" />
        <path d="M18 15v6M15 18h6" />
      </svg>
    ),
  },
];

const MARKETING_NAV: NavItem[] = [
  {
    label: 'Coupons',
    href: '/coupons',
    icon: (
      <svg {...iconProps}>
        <path d="m9 12 2 2 4-4" />
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: (
      <svg {...iconProps}>
        <path d="M12 20V10M6 20V4M18 20v-6" />
      </svg>
    ),
  },
];

const SYSTEM_NAV: NavItem[] = [
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    ),
  },
];

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

      <NavSection label="General" items={GENERAL_NAV} pathname={pathname} />
      <NavSection label="Marketing" items={MARKETING_NAV} pathname={pathname} />
      <NavSection label="System" items={SYSTEM_NAV} pathname={pathname} />

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
