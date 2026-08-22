'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ProductSummary } from '@ecommerce/shared-types';
import { productsApi } from '../../lib/api/products.api';
import { ApiError } from '../../lib/api/client';
import { useAuth } from '../../lib/hooks/useAuth';
import { resolveImageUrl } from '../../lib/utils/image-url';
import { formatPrice } from '../../lib/utils/format-price';
import { selectItemCount, useCartStore } from '../../store/cartStore';
import { CartIcon } from '../ui/icons';

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
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-text-primary">
          miiday<span className="text-accent">.</span>
        </Link>

        <div ref={containerRef} className="relative max-w-md flex-1">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => query.trim() && setOpen(true)}
            placeholder="Search products…"
            aria-label="Search products"
            className="h-11 w-full rounded border border-border bg-surface px-3.5 text-base text-text-primary outline-none transition focus:border-primary"
          />

          {open ? (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-96 overflow-y-auto rounded-lg border border-border bg-background shadow-card">
              {loading ? (
                <p className="px-4 py-3 text-sm text-text-secondary">Searching…</p>
              ) : error ? (
                <p className="px-4 py-3 text-sm text-danger">{error}</p>
              ) : results.length === 0 ? (
                <p className="px-4 py-3 text-sm text-text-secondary">No products found.</p>
              ) : (
                <ul>
                  {results.map((product) => (
                    <li key={product.id}>
                      <Link
                        href={`/products/${product.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-surface"
                      >
                        <div className="h-10 w-8 flex-shrink-0 overflow-hidden rounded bg-surface">
                          {product.image ? (
                            <img
                              src={resolveImageUrl(product.image.url)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <span className="flex-1 truncate text-sm text-text-primary">{product.name}</span>
                        <span className="shrink-0 text-sm font-semibold text-text-primary">
                          {formatPrice(product.price)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <nav className="ml-auto flex shrink-0 items-center gap-4">
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-primary transition hover:text-primary-hover"
          >
            <CartIcon />
            {itemCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-2xs text-accent-foreground">
                {itemCount}
              </span>
            ) : null}
          </Link>
          <Link
            href={status === 'authenticated' ? '/account' : '/login'}
            className="text-sm font-medium text-text-primary hover:text-primary-hover"
          >
            {status === 'authenticated' ? (user?.firstName ?? 'Account') : 'Sign in'}
          </Link>
        </nav>
      </div>
    </header>
  );
}
