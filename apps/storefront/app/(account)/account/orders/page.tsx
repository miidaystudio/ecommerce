'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { OrderSummary } from '@ecommerce/shared-types';
import { Button } from '../../../../components/ui/Button';
import { OrderStatusBadge } from '../../../../components/orders/OrderStatusBadge';
import { ApiError } from '../../../../lib/api/client';
import { ordersApi } from '../../../../lib/api/orders.api';
import { useAuth } from '../../../../lib/hooks/useAuth';
import { formatPrice } from '../../../../lib/utils/format-price';

const PAGE_SIZE = 10;

export default function OrdersPage() {
  const router = useRouter();
  const { status } = useAuth();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await ordersApi.list(page, PAGE_SIZE);
        if (!cancelled) {
          setOrders(result.items);
          setTotalPages(result.totalPages || 1);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [status, page]);

  if (status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-text-secondary">Loading…</p>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <span className="font-mono text-2xs uppercase tracking-[0.15em] text-accent">Account</span>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Order history</h1>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-sm text-text-secondary">You haven&apos;t placed any orders yet.</p>
          <Link href="/products" className="text-sm font-medium text-primary hover:text-primary-hover">
            Browse products →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-background p-5 transition hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{order.orderNumber}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}
                  {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <OrderStatusBadge status={order.status} />
                <span className="text-sm font-semibold text-text-primary">{formatPrice(order.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between text-sm text-text-secondary">
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
