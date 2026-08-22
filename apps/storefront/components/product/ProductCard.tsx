import Link from 'next/link';
import type { ProductSummary } from '@ecommerce/shared-types';
import { resolveImageUrl } from '../../lib/utils/image-url';
import { formatPrice } from '../../lib/utils/format-price';

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-background transition hover:shadow-card"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface">
        {product.image ? (
          <img
            src={resolveImageUrl(product.image.url)}
            alt={product.image.altText ?? product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Product image
            </span>
          </div>
        )}
        {!product.inStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-danger/15 px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.1em] text-danger">
            Out of stock
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 p-4">
        {product.brand ? (
          <span className="text-xs text-text-secondary">{product.brand.name}</span>
        ) : null}
        <h3 className="text-base font-medium leading-snug text-text-primary">{product.name}</h3>
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
