import type { ReactElement } from 'react';

export type NavItem = {
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
    label: 'Reviews',
    href: '/reviews',
    icon: (
      <svg {...iconProps}>
        <path d="m12 3 2.9 5.9 6.1.9-4.5 4.3 1.1 6.4L12 17.6 6.4 20.5l1.1-6.4L3 9.8l6.1-.9L12 3Z" />
      </svg>
    ),
  },
  {
    label: 'Banners',
    href: '/banners',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="m21 16-5-5-6 6" />
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
    label: 'Staff',
    href: '/staff',
    icon: (
      <svg {...iconProps}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 19 7a4 4 0 0 1-3 3.87" />
      </svg>
    ),
  },
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

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  { label: 'General', items: GENERAL_NAV },
  { label: 'Marketing', items: MARKETING_NAV },
  { label: 'System', items: SYSTEM_NAV },
];
