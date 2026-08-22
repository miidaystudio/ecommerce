'use client';

import { useMemo, useState } from 'react';
import type { ProductDetail, ProductVariant } from '@ecommerce/shared-types';
import { Button } from '../ui/Button';
import { resolveImageUrl } from '../../lib/utils/image-url';
import { formatPrice } from '../../lib/utils/format-price';

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

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-10 md:grid-cols-2">
      <div>
        <div className="aspect-[4/5] w-full overflow-hidden rounded-lg border border-border bg-surface">
          {mainImage ? (
            <img
              src={resolveImageUrl(mainImage.url)}
              alt={mainImage.altText ?? product.name}
              className="h-full w-full object-cover"
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
                <img src={resolveImageUrl(image.url)} alt="" className="h-full w-full object-cover" />
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
          disabled={isOutOfStock}
          onClick={() => console.log('Add to cart — coming in a future phase', selected)}
          className="mt-8 w-full md:w-auto md:px-10"
        >
          {isOutOfStock ? 'Out of stock' : 'Add to cart'}
        </Button>
        <p className="mt-2 text-xs text-text-secondary">Cart functionality is coming in a future phase.</p>
      </div>
    </div>
  );
}
