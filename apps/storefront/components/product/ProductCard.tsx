'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import type { ProductSummary } from '@ecommerce/shared-types';
import { resolveImageUrl } from '../../lib/utils/image-url';
import { formatPrice } from '../../lib/utils/format-price';
import { useWishlistStore } from '../../store/wishlistStore';
import { HeartIcon } from '../ui/icons';
import { StarRating } from '../reviews/StarRating';

export function ProductCard({ product }: { product: ProductSummary }) {
  const isWishlisted = useWishlistStore((s) => s.items.some((item) => item.productId === product.id));
  const toggleWishlist = useWishlistStore((s) => s.toggle);

  function handleWishlistClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    void toggleWishlist(
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        inStock: product.inStock,
      },
      product.image ? { url: product.image.url, altText: product.image.altText } : null,
    );
  }

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-background transition hover:shadow-card"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface">
        {product.image ? (
          <Image
            src={resolveImageUrl(product.image.url)}
            alt={product.image.altText ?? product.name}
            fill
            // Two across on phones, three at md, four at lg — matching the
            // grid so the optimizer serves the width actually displayed.
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Product image
            </span>
          </div>
        )}
        {!product.inStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-danger/15 px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.1em] text-danger-strong">
            Out of stock
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleWishlistClick}
          aria-pressed={isWishlisted}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-card transition ${
            isWishlisted ? 'text-danger' : 'text-text-secondary hover:text-primary'
          }`}
        >
          <HeartIcon filled={isWishlisted} className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col gap-1 p-4">
        {product.brand ? (
          <span className="text-xs text-text-secondary">{product.brand.name}</span>
        ) : null}
        <h3 className="text-base font-medium leading-snug text-text-primary">{product.name}</h3>
        {product.ratingCount > 0 ? (
          <div className="mt-0.5 flex items-center gap-1.5">
            <StarRating rating={product.ratingAverage} size="sm" />
            <span className="font-mono text-2xs text-text-secondary">({product.ratingCount})</span>
          </div>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-base font-semibold text-text-primary">{formatPrice(product.price)}</span>
          {product.compareAtPrice ? (
            <span className="text-sm text-text-secondary line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
