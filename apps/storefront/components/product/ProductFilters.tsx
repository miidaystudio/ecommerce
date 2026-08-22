'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Brand, Category } from '@ecommerce/shared-types';
import { buildQueryString } from '../../lib/utils/query-string';

interface ProductFiltersProps {
  categories: Category[];
  brands: Brand[];
  currentParams: Record<string, string | undefined>;
}

export function ProductFilters({ categories, brands, currentParams }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [minPrice, setMinPrice] = useState(currentParams.minPrice ?? '');
  const [maxPrice, setMaxPrice] = useState(currentParams.maxPrice ?? '');

  function navigate(overrides: Record<string, string | undefined>) {
    router.push(`${pathname}${buildQueryString(currentParams, overrides)}`);
  }

  function toggle(key: 'category' | 'brand', slug: string) {
    navigate({ [key]: currentParams[key] === slug ? undefined : slug });
  }

  function applyPriceRange() {
    navigate({ minPrice: minPrice || undefined, maxPrice: maxPrice || undefined });
  }

  const hasActiveFilters = Boolean(
    currentParams.category ||
      currentParams.brand ||
      currentParams.minPrice ||
      currentParams.maxPrice ||
      currentParams.inStock,
  );

  return (
    <aside className="flex flex-col gap-8">
      <div>
        <h2 className="mb-3 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
          Category
        </h2>
        <ul className="flex flex-col gap-2">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => toggle('category', category.slug)}
                className={`text-sm transition ${
                  currentParams.category === category.slug
                    ? 'font-semibold text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {category.name}
              </button>
            </li>
          ))}
          {categories.length === 0 ? <li className="text-sm text-text-secondary">No categories yet.</li> : null}
        </ul>
      </div>

      <div>
        <h2 className="mb-3 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Brand</h2>
        <ul className="flex flex-col gap-2">
          {brands.map((brand) => (
            <li key={brand.id}>
              <button
                type="button"
                onClick={() => toggle('brand', brand.slug)}
                className={`text-sm transition ${
                  currentParams.brand === brand.slug
                    ? 'font-semibold text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {brand.name}
              </button>
            </li>
          ))}
          {brands.length === 0 ? <li className="text-sm text-text-secondary">No brands yet.</li> : null}
        </ul>
      </div>

      <div>
        <h2 className="mb-3 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Price</h2>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            placeholder="Min"
            aria-label="Minimum price"
            className="h-9 w-full rounded border border-border bg-background px-2.5 text-sm text-text-primary outline-none focus:border-primary"
          />
          <span className="text-text-secondary">–</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder="Max"
            aria-label="Maximum price"
            className="h-9 w-full rounded border border-border bg-background px-2.5 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={applyPriceRange}
          className="mt-2 text-xs font-medium text-primary hover:text-primary-hover"
        >
          Apply
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={currentParams.inStock === 'true'}
          onChange={(event) => navigate({ inStock: event.target.checked ? 'true' : undefined })}
          className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-accent"
        />
        In stock only
      </label>

      {hasActiveFilters ? (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-left text-xs font-medium text-text-secondary hover:text-danger"
        >
          Clear all filters
        </button>
      ) : null}
    </aside>
  );
}
