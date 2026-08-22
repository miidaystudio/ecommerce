'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ProductStatus, ProductSummary } from '@ecommerce/shared-types';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api/client';
import { productsApi } from '../../../lib/api/products.api';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import { resolveImageUrl } from '../../../lib/utils/image-url';

const STATUS_TABS: { value: ProductStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const STATUS_TONE: Record<ProductStatus, BadgeTone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  ARCHIVED: 'muted',
};

const PAGE_SIZE = 20;

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export default function ProductsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProductStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await productsApi.listAdmin({
          page,
          pageSize: PAGE_SIZE,
          status: status === 'ALL' ? undefined : status,
          q: debouncedSearch || undefined,
        });
        if (!cancelled) {
          setItems(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages || 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load products');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [page, status, debouncedSearch]);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Products</h1>
          <p className="mt-1.5 text-xs text-text-secondary">{total} product{total === 1 ? '' : 's'} in your catalog</p>
        </div>
        <Link href="/products/new">
          <Button>+ Add product</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-full bg-surface p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                status === tab.value ? 'bg-primary text-primary-foreground' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="h-10 w-full rounded border border-border bg-background px-3.5 text-sm text-text-primary outline-none focus:border-primary sm:w-64"
        />
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface text-2xs uppercase tracking-[0.1em] text-text-secondary">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Brand</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-text-secondary">
                    Loading products…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-text-secondary">
                    No products found.
                  </td>
                </tr>
              ) : (
                items.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => router.push(`/products/${product.id}/edit`)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-surface"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveImageUrl(product.image.url)}
                            alt={product.image.altText ?? product.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-surface" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-text-primary">{product.name}</div>
                          <div className="text-2xs text-text-secondary">{product.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{product.category.name}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{product.brand?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-semibold text-text-primary">{formatPrice(product.price)}</span>
                      {product.compareAtPrice ? (
                        <span className="ml-1.5 text-2xs text-text-secondary line-through">
                          {formatPrice(product.compareAtPrice)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={product.inStock ? 'success' : 'danger'}>
                        {product.inStock ? 'In stock' : 'Out of stock'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[product.status]}>{product.status}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
