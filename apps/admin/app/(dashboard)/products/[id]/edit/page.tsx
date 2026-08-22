'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import type { ProductDetail } from '@ecommerce/shared-types';
import { ProductForm } from '../../../../../components/product/ProductForm';
import { ApiError } from '../../../../../lib/api/client';
import { productsApi } from '../../../../../lib/api/products.api';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await productsApi.getById(id);
        if (!cancelled) setProduct(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load product');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div>
      <div className="mb-6">
        <Link href="/products" className="text-xs font-medium text-text-secondary hover:text-primary">
          ← Back to products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
          {product?.name ?? 'Edit product'}
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Loading product…</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : product ? (
        <ProductForm mode="edit" product={product} />
      ) : null}
    </div>
  );
}
