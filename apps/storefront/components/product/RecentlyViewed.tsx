'use client';

import { useEffect, useState } from 'react';
import type { ProductSummary } from '@ecommerce/shared-types';
import { ProductRow } from './ProductRow';
import { productsApi } from '../../lib/api/products.api';
import { readRecentlyViewed, recordRecentlyViewed } from '../../lib/utils/recently-viewed';

/** Records the product being viewed, then shows the rest of the viewer's history. */
export function RecentlyViewed({ currentProductId }: { currentProductId: string }) {
  const [products, setProducts] = useState<ProductSummary[]>([]);

  useEffect(() => {
    const history = recordRecentlyViewed(currentProductId).filter((id) => id !== currentProductId);
    if (history.length === 0) {
      setProducts([]);
      return;
    }

    let cancelled = false;
    async function load(ids: string[]) {
      try {
        const result = await productsApi.recentlyViewed(ids);
        if (!cancelled) setProducts(result);
      } catch {
        // A browsing-history strip is non-essential — fail quietly.
        if (!cancelled) setProducts([]);
      }
    }
    load(history);
    return () => {
      cancelled = true;
    };
  }, [currentProductId]);

  return <ProductRow eyebrow="Recently viewed" heading="Picking up where you left off" products={products} />;
}

/** History-only strip for pages that aren't a product page (e.g. the cart). */
export function RecentlyViewedStrip() {
  const [products, setProducts] = useState<ProductSummary[]>([]);

  useEffect(() => {
    const history = readRecentlyViewed();
    if (history.length === 0) return;

    let cancelled = false;
    async function load(ids: string[]) {
      try {
        const result = await productsApi.recentlyViewed(ids);
        if (!cancelled) setProducts(result);
      } catch {
        if (!cancelled) setProducts([]);
      }
    }
    load(history);
    return () => {
      cancelled = true;
    };
  }, []);

  return <ProductRow eyebrow="Recently viewed" heading="Recently viewed" products={products} />;
}
