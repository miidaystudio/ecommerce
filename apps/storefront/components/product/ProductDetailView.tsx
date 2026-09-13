'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { ProductDetail, ProductVariant } from '@ecommerce/shared-types';
import { Button } from '../ui/Button';
import { HeartIcon } from '../ui/icons';
import { resolveImageUrl } from '../../lib/utils/image-url';
import { formatPrice } from '../../lib/utils/format-price';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';

const ADDED_STATE_MS = 1500;

function getInitialVariant(variants: ProductVariant[]): ProductVariant | undefined {
  return variants.find((variant) => variant.isDefault) ?? variants.find((variant) => variant.stock > 0) ?? variants[0];
}

export function ProductDetailView({ product }: { product: ProductDetail }) {
  const variants = product.variants;

  const attributeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const variant of variants) {
      if (variant.attributes) {
        for (const key of Object.keys(variant.attributes)) {
          keys.add(key);
        }
      }
    }
    return Array.from(keys);
  }, [variants]);

  const [selected, setSelected] = useState<ProductVariant | undefined>(() => getInitialVariant(variants));
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const addItem = useCartStore((s) => s.addItem);
  const cartError = useCartStore((s) => s.error);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const isWishlisted = useWishlistStore((s) => s.items.some((item) => item.productId === product.id));

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), ADDED_STATE_MS);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const selection: Record<string, string> = selected?.attributes ?? {};

  function chooseAttribute(key: string, value: string) {
    const nextSelection = { ...selection, [key]: value };
    const match = variants.find((variant) =>
      attributeKeys.every((k) => (variant.attributes?.[k] ?? '') === (nextSelection[k] ?? '')),
    );
    if (match) {
      setSelected(match);
    }
  }

  const images = product.images;
  const mainImage = images[activeImageIndex];
  const isOutOfStock = !selected || selected.stock === 0;

  async function handleAddToCart() {
    if (!selected) return;
    setAdding(true);
    await addItem(
      selected,
      { id: product.id, name: product.name, slug: product.slug },
      mainImage ? { url: mainImage.url, altText: mainImage.altText } : null,
      1,
    );
    setAdding(false);
    if (!useCartStore.getState().error) {
      setJustAdded(true);
    }
  }

  function handleWishlistToggle() {
    void toggleWishlist(
      {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: selected?.price ?? 0,
        compareAtPrice: selected?.compareAtPrice ?? null,
        inStock: selected ? selected.stock > 0 : false,
      },
      mainImage ? { url: mainImage.url, altText: mainImage.altText } : null,
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-10 md:grid-cols-2">
      <div>
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-surface">
          {mainImage ? (
            <Image
              src={resolveImageUrl(mainImage.url)}
              alt={mainImage.altText ?? product.name}
              fill
              // Full width on phones, half the 1152px container on desktop.
              sizes="(max-width: 768px) 100vw, 576px"
              // The LCP element on a product page, so it is not lazy-loaded.
              priority
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
                Product image
              </span>
            </div>
          )}
        </div>

        {images.length > 1 ? (
          <div className="mt-4 flex gap-3">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImageIndex(index)}
                aria-label={`Show image ${index + 1}`}
                aria-current={index === activeImageIndex}
                className={`h-16 w-14 overflow-hidden rounded border transition ${
                  index === activeImageIndex ? 'border-primary' : 'border-border hover:border-primary/40'
                }`}
              >
                <Image
                  src={resolveImageUrl(image.url)}
                  alt=""
                  width={56}
                  height={64}
                  sizes="56px"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        {product.brand ? <span className="text-sm text-text-secondary">{product.brand.name}</span> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">{product.name}</h1>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-lg font-semibold text-text-primary">{formatPrice(selected?.price ?? 0)}</span>
          {selected?.compareAtPrice ? (
            <span className="text-md text-text-secondary line-through">
              {formatPrice(selected.compareAtPrice)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleWishlistToggle}
            aria-pressed={isWishlisted}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className={`ml-auto flex h-9 w-9 items-center justify-center rounded-full border transition ${
              isWishlisted
                ? 'border-danger/40 text-danger'
                : 'border-border text-text-secondary hover:border-primary/40 hover:text-primary'
            }`}
          >
            <HeartIcon filled={isWishlisted} className="h-4 w-4" />
          </button>
        </div>

        {attributeKeys.map((key) => {
          const values = Array.from(
            new Set(variants.map((variant) => variant.attributes?.[key]).filter((v): v is string => Boolean(v))),
          );

          return (
            <div key={key} className="mt-6">
              <h2 className="mb-2 text-sm font-medium capitalize text-text-primary">{key}</h2>
              <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                  const isActive = selection[key] === value;
                  const matchingVariant = variants.find((variant) =>
                    attributeKeys.every((k) =>
                      k === key ? variant.attributes?.[k] === value : (variant.attributes?.[k] ?? '') === (selection[k] ?? ''),
                    ),
                  );
                  const isUnavailable = !matchingVariant || matchingVariant.stock === 0;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => chooseAttribute(key, value)}
                      disabled={isUnavailable}
                      aria-pressed={isActive}
                      className={`rounded border px-3.5 py-2 text-sm transition ${
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isUnavailable
                            ? 'cursor-not-allowed border-border text-muted-border line-through'
                            : 'border-border text-text-primary hover:border-primary/40'
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {selected ? (
          <p className="mt-4 text-sm">
            {selected.stock > 0 ? (
              <span className="text-success">In stock</span>
            ) : (
              <span className="text-danger">Out of stock</span>
            )}
          </p>
        ) : null}

        <p className="mt-6 max-w-md text-md leading-relaxed text-text-secondary">{product.description}</p>

        <Button
          type="button"
          disabled={isOutOfStock || adding}
          onClick={handleAddToCart}
          className="mt-8 w-full md:w-auto md:px-10"
        >
          {isOutOfStock ? 'Out of stock' : justAdded ? 'Added ✓' : adding ? 'Adding…' : 'Add to cart'}
        </Button>
        {cartError ? <p className="mt-2 text-xs text-danger">{cartError}</p> : null}
      </div>
    </div>
  );
}
