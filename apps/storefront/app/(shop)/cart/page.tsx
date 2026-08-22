'use client';

import Link from 'next/link';
import { Button } from '../../../components/ui/Button';
import { resolveImageUrl } from '../../../lib/utils/image-url';
import { formatPrice } from '../../../lib/utils/format-price';
import { selectSubtotal, useCartStore } from '../../../store/cartStore';

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const loading = useCartStore((s) => s.loading);
  const error = useCartStore((s) => s.error);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = selectSubtotal(items);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-24 text-center">
        <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Cart</span>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Your cart is empty</h1>
        <p className="max-w-sm text-sm text-text-secondary">Browse the catalog and add something you love.</p>
        <Link href="/products">
          <Button type="button">Continue shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Cart</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">Your cart</h1>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-background">
          {items.map((item) => {
            const unavailable = !item.available || item.stock === 0;
            return (
              <li key={item.variantId} className="flex gap-4 p-4">
                <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded bg-surface">
                  {item.image ? (
                    <img
                      src={resolveImageUrl(item.image.url)}
                      alt={item.image.altText ?? item.product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary">—</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1">
                  <Link
                    href={`/products/${item.product.slug}`}
                    className="text-base font-medium text-text-primary hover:text-primary-hover"
                  >
                    {item.product.name}
                  </Link>
                  {item.variant.name ? (
                    <p className="text-xs text-text-secondary">
                      {item.variant.attributes
                        ? Object.entries(item.variant.attributes)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(' · ')
                        : item.variant.name}
                    </p>
                  ) : null}

                  {unavailable ? (
                    <span className="w-fit rounded-full bg-danger/15 px-2.5 py-0.5 font-mono text-2xs uppercase tracking-[0.1em] text-danger">
                      {item.stock === 0 ? 'Out of stock' : 'Unavailable'}
                    </span>
                  ) : null}

                  <div className="mt-auto flex items-center gap-3">
                    <div className="flex items-center rounded border border-border">
                      <button
                        type="button"
                        disabled={unavailable || loading || item.quantity <= 1}
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="flex h-8 w-8 items-center justify-center text-text-primary transition disabled:cursor-not-allowed disabled:text-muted-border"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm text-text-primary">{item.quantity}</span>
                      <button
                        type="button"
                        disabled={unavailable || loading || item.quantity >= item.stock}
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="flex h-8 w-8 items-center justify-center text-text-primary transition disabled:cursor-not-allowed disabled:text-muted-border"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.variantId)}
                      disabled={loading}
                      className="text-xs text-text-secondary underline transition hover:text-danger disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-base font-semibold text-text-primary">{formatPrice(item.lineTotal)}</p>
                  {item.compareAtPrice ? (
                    <p className="text-xs text-text-secondary line-through">
                      {formatPrice(item.compareAtPrice * item.quantity)}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="h-fit rounded-lg border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Subtotal</span>
            <span className="font-semibold text-text-primary">{formatPrice(subtotal)}</span>
          </div>
          <Button type="button" disabled className="mt-5 w-full">
            Proceed to checkout
          </Button>
          <p className="mt-2 text-xs text-text-secondary">Checkout arrives in a future phase.</p>
        </div>
      </div>
    </div>
  );
}
