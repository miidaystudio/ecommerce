'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpIcon, CheckIcon } from '../ui/icons';

const FLEET_LINKS = [
  { href: '/products', label: 'All Products' },
  { href: '/cart', label: 'Shopping Cart' },
  { href: '/account', label: 'Customer Account' },
];

const ORGANIZATION_LINKS = [
  { href: '/about', label: 'About Studio' },
  { href: '/contact', label: 'Contact Us' },
  { href: '/policy/terms', label: 'Terms & Privacy' },
];

const NETWORK_LINKS = [
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Support & Help' },
  { href: 'https://github.com/miidaystudio', label: 'GitHub ↗' },
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
    <footer className="w-full bg-[#111315] text-white pt-12 pb-8 px-6 sm:px-10 rounded-t-[2.5rem] mt-16 font-sans relative">
      <div className="mx-auto max-w-6xl">
        
        {/* Top Header Row with Status & Back to Top */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-8 border-b border-white/10 gap-4 mb-10">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-xs text-neutral-300 uppercase tracking-wider">
              ATELIER STATUS: <span className="text-emerald-400 font-bold">OPERATIONAL // v2026.4</span>
            </span>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neutral-300 hover:text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10 transition shadow-2xs"
          >
            <span>BACK TO TOP</span>
            <ArrowUpIcon className="h-3.5 w-3.5 text-emerald-400" />
          </button>
        </div>

        {/* 5-Column Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 mb-12 items-start font-mono">
          
          {/* Brand Column (md:col-span-4) */}
          <div className="col-span-2 md:col-span-4 flex flex-col justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5 group mb-3">
                <svg width="26" height="26" viewBox="0 0 64 64" fill="none" className="shrink-0 transition-transform group-hover:scale-105 rounded-md overflow-hidden">
                  <rect width="64" height="64" rx="14" fill="#4A4238"/>
                  <text x="29" y="44" fontFamily="Manrope, Inter, system-ui, sans-serif" fontSize="36" fontWeight="700" textAnchor="middle" fill="#F5F2EA">m</text>
                  <circle cx="50" cy="41" r="4.5" fill="#C9A876"/>
                </svg>
                <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-white group-hover:text-emerald-400 transition-colors">
                  MIIDAY
                </h2>
              </Link>
              <p className="text-neutral-400 text-xs max-w-xs leading-relaxed font-sans mb-4">
                High-fashion digital flagship &amp; engineering atelier. Crafting zero-waste garments, technical outerwear, and editorial infrastructure.
              </p>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-neutral-400">
                <span className="bg-white/10 px-2.5 py-1 rounded-md border border-white/10 text-emerald-400 font-bold">NEXT.JS 15</span>
                <span className="bg-white/10 px-2.5 py-1 rounded-md border border-white/10">GSAP + LENIS</span>
                <span className="bg-white/10 px-2.5 py-1 rounded-md border border-white/10">SWISS EDITORIAL</span>
              </div>
            </div>
          </div>

          {/* Column 2: FLEET REPOS */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-mono text-xs font-black uppercase tracking-widest text-neutral-300 mb-4">
              COLLECTIONS
            </h3>
            <ul className="flex flex-col gap-2.5 text-xs text-neutral-400">
              {FLEET_LINKS.map((link) => (
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
              ATELIER
            </h3>
            <ul className="flex flex-col gap-2.5 text-xs text-neutral-400">
              {ORGANIZATION_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="transition hover:text-emerald-400">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: NETWORK */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-mono text-xs font-black uppercase tracking-widest text-neutral-300 mb-4">
              NETWORK
            </h3>
            <ul className="flex flex-col gap-2.5 text-xs text-neutral-400">
              {NETWORK_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="transition hover:text-emerald-400">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 5: TELEMETRY DISPATCH */}
          <div className="col-span-2 md:col-span-2">
            <h3 className="font-mono text-xs font-black uppercase tracking-widest text-neutral-300 mb-4">
              DISPATCH
            </h3>
            <p className="text-2xs text-neutral-400 mb-3 font-sans">
              Subscribe to drop notifications &amp; release logs.
            </p>

            {subscribed ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs p-3 rounded-2xl flex items-center gap-2">
                <CheckIcon className="h-4 w-4 shrink-0" />
                <span>SUBSCRIBED</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="relative flex items-center rounded-full border border-white/20 bg-white/5 p-1.5 focus-within:border-white/50 transition">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="EMAIL ADDRESS"
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

        {/* Hairline Divider & Bottom Baseline Row */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-neutral-400 gap-3">
          <span>© 2026 // MIIDAY STUDIO. ALL RIGHTS RESERVED.</span>
          <div className="flex items-center gap-4">
            <Link href="/policy/terms" className="hover:text-white transition">TERMS</Link>
            <span>•</span>
            <Link href="/policy/terms" className="hover:text-white transition">PRIVACY</Link>
            <span>•</span>
            <span className="text-emerald-400 font-bold">ENGINEERED IN INDIA // HIGH PRECISION</span>
          </div>
        </div>

      </div>
    </footer>
  );
}