'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/hooks/useAuth';
import { NAV_SECTIONS, type NavItem } from './nav-items';

function NavSection({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  return (
    <>
      <div className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase px-3.5 mt-6 mb-2">
        {label}
      </div>
      <nav className="flex flex-col gap-1 px-1">
        {items.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? 'bg-white/10 text-white font-medium rounded-xl px-3.5 py-2.5 text-xs flex items-center gap-3 border border-white/10 shadow-xs'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04] transition-colors rounded-xl px-3.5 py-2.5 text-xs flex items-center gap-3'
              }
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
              {item.badge ? (
                <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-mono">{item.badge}</span>
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
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'AD';

  return (
    <aside className="hidden h-full w-64 shrink-0 overflow-y-auto flex-col justify-between bg-[#111315] border-r border-white/5 p-4 md:flex font-sans scrollbar-none">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-3 py-2 mb-2">
          <svg width="24" height="24" viewBox="0 0 64 64" fill="none" className="shrink-0 rounded-md overflow-hidden">
            <rect width="64" height="64" rx="14" fill="#4A4238"/>
            <text x="29" y="44" fontFamily="Manrope, Inter, system-ui, sans-serif" fontSize="36" fontWeight="700" textAnchor="middle" fill="#F5F2EA">m</text>
            <circle cx="50" cy="41" r="4.5" fill="#C9A876"/>
          </svg>
          <span className="text-base font-black tracking-tight text-white uppercase leading-none">
            MIIDAY
          </span>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono px-2 py-0.5 rounded-full uppercase">
            ADMIN
          </span>
        </div>

        {/* Navigation Sections */}
        {NAV_SECTIONS.map((section) => (
          <NavSection key={section.label} label={section.label} items={section.items} pathname={pathname} />
        ))}
      </div>

      {/* User Footer Profile */}
      <div className="mt-8 border-t border-white/10 pt-4 px-2">
        <div className="flex items-center gap-3 py-1">
          <div className="w-8 h-8 rounded-full bg-[#E5D7B7] text-[#4A3B18] font-bold text-xs flex items-center justify-center border border-neutral-300 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0 font-mono">
            <div className="text-xs text-white truncate font-medium">{user?.email ?? 'admin@miiday.com'}</div>
            <div className="text-[10px] text-neutral-400 uppercase tracking-wider">{user?.role ?? 'SUPER_ADMIN'}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

