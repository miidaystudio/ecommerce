'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ProductSummary } from '@ecommerce/shared-types';
import { productsApi } from '../../lib/api/products.api';
import { ApiError } from '../../lib/api/client';
import { useAuth } from '../../lib/hooks/useAuth';
import { resolveImageUrl } from '../../lib/utils/image-url';
import { formatPrice } from '../../lib/utils/format-price';
import { selectItemCount, useCartStore } from '../../store/cartStore';
import { CartIcon, HeartIcon, SearchIcon, MenuIcon, CloseIcon } from '../ui/icons';

const SEARCH_DEBOUNCE_MS = 250;

export function SiteHeader() {
  const { user, status } = useAuth();
  const cartItems = useCartStore((s) => s.items);
  const itemCount = selectItemCount(cartItems);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setOpen(false);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = setTimeout(() => {
      productsApi
        .search(trimmed)
        .then((items) => {
          setResults(items);
          setError('');
        })
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : 'Search failed. Try again.');
          setResults([]);
        })
        .finally(() => {
          setLoading(false);
          setOpen(true);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="sticky top-0 z-50 w-full font-sans">
      {/* Top Announcement Strip */}
      <div className="w-full bg-neutral-950 text-white text-[11px] font-mono py-1.5 px-4 flex items-center justify-between gap-2 tracking-wider uppercase border-b border-neutral-900">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="truncate">
            MIIDAY STUDIO // ALL SYSTEMS OPERATIONAL // SHIPPING PRODUCTION ENGINES
          </span>
        </div>
        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition shrink-0"
        >
          [ ADMIN DASHBOARD ↗ ]
        </a>
      </div>

      {/* Main Sticky Navbar */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4">
          
          {/* Left: Mobile Menu Toggle & Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-neutral-700 hover:bg-neutral-100 transition"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>

            <Link href="/" className="shrink-0 flex items-center gap-2 group">
              <span className="font-black tracking-tighter text-lg sm:text-xl text-neutral-950 uppercase leading-none">
                MIIDAY
              </span>
              <span className="font-mono text-3xs font-black uppercase px-1.5 py-0.5 rounded bg-neutral-950 text-emerald-400 border border-emerald-400/30">
                SHOP
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-7 text-xs font-semibold tracking-wider text-neutral-700 font-mono">
            <Link href="/repositories" className="transition hover:text-neutral-950 uppercase hover:underline underline-offset-4">
              [ LABS ]
            </Link>
            <Link href="/repositories" className="transition hover:text-neutral-950 uppercase hover:underline underline-offset-4">
              [ REPOSITORIES ]
            </Link>
            <Link href="/products" className="transition hover:text-neutral-950 uppercase hover:underline underline-offset-4">
              [ CAPABILITIES ]
            </Link>
            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noopener noreferrer"
              className="transition text-emerald-600 hover:text-emerald-700 font-bold uppercase hover:underline underline-offset-4"
            >
              [ ADMIN DASHBOARD ↗ ]
            </a>
            <Link href="/about" className="transition hover:text-neutral-950 uppercase hover:underline underline-offset-4">
              [ STUDIO ]
            </Link>
          </nav>

          {/* Right Utility Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            
            {/* Search Pill */}
            <div ref={containerRef} className="relative w-32 sm:w-48 lg:w-56">
              <div className="relative flex items-center rounded-full bg-neutral-100 hover:bg-neutral-150 focus-within:bg-white focus-within:ring-1 focus-within:ring-neutral-950 px-3 py-1.5 transition-all border border-neutral-200">
                <SearchIcon className="h-3.5 w-3.5 text-neutral-400 shrink-0 mr-1.5" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={() => query.trim() && setOpen(true)}
                  placeholder="Search fleet…"
                  aria-label="Search fleet"
                  className="w-full bg-transparent text-xs text-neutral-900 placeholder-neutral-400 outline-none font-mono"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setOpen(false);
                    }}
                    className="text-neutral-400 hover:text-neutral-800 text-xs font-mono ml-1"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {open ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 sm:w-80 max-h-96 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl">
                  {loading ? (
                    <p className="p-3 text-xs font-mono text-neutral-500">Searching engine database…</p>
                  ) : error ? (
                    <p className="p-3 text-xs font-mono text-red-500">{error}</p>
                  ) : results.length === 0 ? (
                    <p className="p-3 text-xs font-mono text-neutral-500">No telemetry results match query.</p>
                  ) : (
                    <ul className="divide-y divide-neutral-100 font-mono">
                      {results.map((product) => (
                        <li key={product.id}>
                          <Link
                            href={`/products/${product.slug}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-neutral-50"
                          >
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-100 border border-neutral-200">
                              {product.image ? (
                                <Image
                                  src={resolveImageUrl(product.image.url)}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-xs font-bold text-neutral-900">{product.name}</p>
                              <p className="text-2xs text-neutral-500">{formatPrice(product.price)}</p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            {/* Star / GitHub Badge */}
            <a
              href="https://github.com/miidaystudio"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Repository"
              className="hidden xs:flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-800 transition hover:bg-neutral-950 hover:text-white shadow-2xs"
            >
              <span className="text-xs">★</span>
            </a>

            {/* Cart Icon Button */}
            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-800 transition hover:bg-neutral-950 hover:text-white shadow-2xs"
            >
              <CartIcon className="h-4.5 w-4.5" />
              {itemCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-emerald-500 px-1 font-mono text-[10px] font-bold text-neutral-950 border border-white">
                  {itemCount}
                </span>
              ) : (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-neutral-950 font-mono text-[9px] font-bold text-white border border-white">
                  0
                </span>
              )}
            </Link>

            {/* Sign In Link / Profile */}
            <Link
              href={status === 'authenticated' ? '/account' : '/login'}
              className="text-xs font-mono font-bold uppercase text-neutral-800 hover:text-black hidden sm:block ml-1 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-full border border-neutral-200 transition"
            >
              {status === 'authenticated' ? (user?.firstName ?? 'Account') : 'Sign in'}
            </Link>

          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-[88px] bottom-0 bg-neutral-950/80 backdrop-blur-md z-40 flex flex-col justify-between p-6 text-white border-t border-neutral-800 animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-4 font-mono text-sm tracking-wider uppercase">
            <Link
              href="/repositories"
              onClick={() => setMobileMenuOpen(false)}
              className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-400 transition flex items-center justify-between"
            >
              <span>[ LABS ]</span>
              <span className="text-emerald-400 text-xs">EXPLORE →</span>
            </Link>
            <Link
              href="/repositories"
              onClick={() => setMobileMenuOpen(false)}
              className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-400 transition flex items-center justify-between"
            >
              <span>[ REPOSITORIES ]</span>
              <span className="text-emerald-400 text-xs">FLEET →</span>
            </Link>
            <Link
              href="/products"
              onClick={() => setMobileMenuOpen(false)}
              className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-400 transition flex items-center justify-between"
            >
              <span>[ CAPABILITIES ]</span>
              <span className="text-emerald-400 text-xs">CATALOG →</span>
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-400 transition flex items-center justify-between"
            >
              <span>[ COMMUNITY ]</span>
              <span className="text-emerald-400 text-xs">JOIN →</span>
            </Link>
            <Link
              href="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-400 transition flex items-center justify-between"
            >
              <span>[ STUDIO ]</span>
              <span className="text-emerald-400 text-xs">INFO →</span>
            </Link>
          </nav>

          <div className="pt-6 border-t border-neutral-800 font-mono text-xs flex flex-col gap-3">
            <Link
              href={status === 'authenticated' ? '/account' : '/login'}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center bg-white text-neutral-950 font-bold py-3 rounded-xl uppercase tracking-wider shadow-lg"
            >
              {status === 'authenticated' ? (user?.firstName ?? 'MY ACCOUNT') : 'SIGN IN TO SHOP'}
            </Link>
            <p className="text-center text-neutral-500 text-2xs">
              MIIDAY STUDIO TELEMETRY // v2026.4
            </p>
          </div>
        </div>
      )}
    </div>
  );
}



