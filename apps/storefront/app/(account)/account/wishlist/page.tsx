'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { WishlistItemView } from '@ecommerce/shared-types';
import { useAuth } from '../../../../lib/hooks/useAuth';
import { useWishlistStore } from '../../../../store/wishlistStore';
import { resolveImageUrl } from '../../../../lib/utils/image-url';
import { formatPrice } from '../../../../lib/utils/format-price';

export default function WishlistPage() {
  const router = useRouter();
  const { status } = useAuth();
  const items = useWishlistStore((s) => s.items);
  const loading = useWishlistStore((s) => s.loading);
  const error = useWishlistStore((s) => s.error);
  const toggle = useWishlistStore((s) => s.toggle);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-text-secondary">Loading your wishlist…</p>
      </main>
    );
  }

  function handleRemove(item: WishlistItemView) {
    void toggle(
      {
        id: item.productId,
        name: item.product.name,
        slug: item.product.slug,
        price: item.product.price,
        compareAtPrice: item.product.compareAtPrice,
        inStock: item.product.inStock,
      },
      item.image,
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <span className="font-mono text-2xs uppercase tracking-[0.15em] text-accent">Account</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Wishlist</h1>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-text-secondary">Your wishlist is empty.</p>
          <Link href="/products" className="text-sm font-medium text-primary hover:text-primary-hover">
            Browse products →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="group flex flex-col overflow-hidden rounded-lg border border-border bg-background transition hover:shadow-card"
            >
              <Link
                href={`/products/${item.product.slug}`}
                className="relative block aspect-[4/5] w-full overflow-hidden bg-surface"
              >
                {item.image ? (
                  <img
                    src={resolveImageUrl(item.image.url)}
                    alt={item.image.altText ?? item.product.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
                      Product image
                    </span>
                  </div>
                )}
                {!item.product.inStock ? (
                  <span className="absolute left-3 top-3 rounded-full bg-danger/15 px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.1em] text-danger">
                    Out of stock
                  </span>
                ) : null}
              </Link>
              <div className="flex flex-col gap-1 p-4">
                <Link
                  href={`/products/${item.product.slug}`}
                  className="text-base font-medium leading-snug text-text-primary hover:text-primary-hover"
                >
                  {item.product.name}
                </Link>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-base font-semibold text-text-primary">
                    {formatPrice(item.product.price)}
                  </span>
                  {item.product.compareAtPrice ? (
                    <span className="text-sm text-text-secondary line-through">
                      {formatPrice(item.product.compareAtPrice)}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(item)}
                  disabled={loading}
                  className="mt-2 w-fit text-xs text-text-secondary underline transition hover:text-danger disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
