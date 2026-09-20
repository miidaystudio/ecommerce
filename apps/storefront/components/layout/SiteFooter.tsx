'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpIcon, CheckIcon } from '../ui/icons';

const PROJECTS_LINKS = [
  { href: '/repositories', label: 'Ecommerce-Mono' },
  { href: '/repositories', label: 'Antigravity-CLI' },
  { href: '/repositories', label: 'PureModa-Storefront' },
  { href: '/repositories', label: 'Stitch-MCP-Server' },
];

const ORGANIZATION_LINKS = [
  { href: 'http://localhost:3001', label: 'Admin Dashboard ↗' },
  { href: '/about', label: 'Miiday Studio' },
  { href: 'https://github.com/miidaystudio', label: 'GitHub Fleet' },
  { href: '/about', label: 'Brand Assets' },
  { href: '/policy/terms', label: 'Terms & Privacy' },
];

const SOCIAL_LINKS = [
  { href: 'https://github.com/miidaystudio', label: 'GitHub ↗' },
  { href: 'https://linkedin.com', label: 'LinkedIn ↗' },
  { href: 'https://twitter.com', label: 'Twitter ↗' },
  { href: 'https://instagram.com', label: 'Instagram ↗' },
];

export function SiteFooter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full bg-neutral-950 text-white pt-16 pb-12 px-6 sm:px-12 border-t border-neutral-900 mt-20 font-sans relative">
      <div className="mx-auto max-w-[1400px]">
        
        {/* Top Header Row with System Status & Back to Top */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-10 border-b border-neutral-900 gap-4 mb-12">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-xs text-neutral-300 uppercase tracking-wider">
              SYSTEM STATUS: <span className="text-emerald-400 font-bold">99.99% UPTIME</span>
            </span>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-850 px-4 py-2 rounded-full border border-neutral-800 transition"
          >
            <span>BACK TO TOP</span>
            <ArrowUpIcon className="h-3.5 w-3.5 text-emerald-400" />
          </button>
        </div>

        {/* Multi-column Main Grid */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 mb-16 items-start">
          
          {/* Brand Column (md:col-span-4) */}
          <div className="col-span-2 md:col-span-4 flex flex-col justify-between">
            <div>
              <Link href="/" className="inline-block group mb-3">
                <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-white group-hover:text-emerald-400 transition-colors">
                  MIIDAY
                </h2>
              </Link>
              <p className="text-neutral-400 text-xs max-w-xs leading-relaxed font-sans mb-4">
                Autonomous web engineering and design atelier. Building open-source software, high-speed telemetry, and custom web infrastructure.
              </p>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-neutral-400">
                <span className="bg-neutral-900 px-2.5 py-1 rounded-md border border-neutral-800 text-emerald-400 font-bold">NEXT.JS 15</span>
                <span className="bg-neutral-900 px-2.5 py-1 rounded-md border border-neutral-800">TAILWIND CSS</span>
                <span className="bg-neutral-900 px-2.5 py-1 rounded-md border border-neutral-800">TURBO REPO</span>
              </div>
            </div>
          </div>

          {/* Column 2: PROJECTS */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-mono text-xs font-black uppercase tracking-widest text-neutral-300 mb-4">
              FLEET REPOS
            </h3>
            <ul className="flex flex-col gap-2.5 font-mono text-xs text-neutral-400">
              {PROJECTS_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition hover:text-emerald-400">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: ORGANIZATION */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-mono text-xs font-black uppercase tracking-widest text-neutral-300 mb-4">
              ORGANIZATION
            </h3>
            <ul className="flex flex-col gap-2.5 font-mono text-xs text-neutral-400">
              {ORGANIZATION_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition hover:text-emerald-400">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: SOCIAL */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-mono text-xs font-black uppercase tracking-widest text-neutral-300 mb-4">
              NETWORK
            </h3>
            <ul className="flex flex-col gap-2.5 font-mono text-xs text-neutral-400">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="transition hover:text-emerald-400">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 5: JOIN NEWSLETTER */}
          <div className="col-span-2 md:col-span-2">
            <h3 className="font-mono text-xs font-black uppercase tracking-widest text-neutral-300 mb-4">
              TELEMETRY DISPATCH
            </h3>
            <p className="text-2xs text-neutral-400 mb-3 font-sans">
              Subscribe to weekly architecture breakdowns and release logs.
            </p>

            {subscribed ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs p-3 rounded-2xl flex items-center gap-2">
                <CheckIcon className="h-4 w-4 shrink-0" />
                <span>SUBSCRIBED TO DISPATCH</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="relative flex items-center rounded-full border border-neutral-800 bg-neutral-900 p-1.5 focus-within:border-neutral-500 transition">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ENGINEER EMAIL"
                  required
                  className="w-full bg-transparent px-3 text-[11px] font-mono uppercase text-white placeholder-neutral-500 outline-none"
                />
                <button
                  type="submit"
                  aria-label="Subscribe"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-emerald-400 hover:scale-105"
                >
                  <span className="text-xs font-bold">→</span>
                </button>
              </form>
            )}
          </div>

        </div>

        {/* Hairline Divider & Bottom Row */}
        <div className="border-t border-neutral-900 pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-neutral-500 gap-3">
          <span>© 2026 // MIIDAY STUDIO. ALL RIGHTS RESERVED.</span>
          <div className="flex items-center gap-4">
            <Link href="/policy/terms" className="hover:text-neutral-300 transition">TERMS</Link>
            <span>•</span>
            <Link href="/policy/terms" className="hover:text-neutral-300 transition">PRIVACY</Link>
            <span>•</span>
            <span>ENGINEERED WITH HIGH PRECISION</span>
          </div>
        </div>

      </div>
    </footer>
  );
}

