'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { OrderDetail } from '@ecommerce/shared-types';
import { Button } from '../../../../components/ui/Button';
import { OrderStatusBadge } from '../../../../components/orders/OrderStatusBadge';
import { ApiError } from '../../../../lib/api/client';
import { ordersApi } from '../../../../lib/api/orders.api';
import { formatPrice } from '../../../../lib/utils/format-price';

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background px-4">
          <p className="text-sm text-text-secondary">Loading your order…</p>
        </main>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('No order to show.');
      return;
    }
    let cancelled = false;
    ordersApi
      .getById(orderId)
      .then((result) => {
        if (!cancelled) setOrder(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load this order.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-text-secondary">Loading your order…</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-danger">{error || 'Order not found.'}</p>
        <Link href="/account/orders" className="text-sm font-medium text-primary hover:text-primary-hover">
          View your orders
        </Link>
      </main>
    );
  }

  const isConfirmed = order.status !== 'PENDING' && order.status !== 'CANCELLED';

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <span className="font-mono text-2xs uppercase tracking-[0.15em] text-accent">
        {isConfirmed ? 'Order confirmed' : 'Order received'}
      </span>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
        {isConfirmed ? 'Thank you for your order' : 'We’re confirming your payment'}
      </h1>
      <p className="mt-2 text-sm text-text-secondary">Order {order.orderNumber}</p>
      <div className="mt-2 flex justify-center">
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-8 rounded-lg border border-border bg-surface p-6 text-left">
        <ul className="flex flex-col gap-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span className="text-text-primary">
                {item.productName} <span className="text-text-secondary">· {item.variantName} × {item.quantity}</span>
              </span>
              <span className="font-medium text-text-primary">{formatPrice(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between text-text-secondary">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Shipping</span>
            <span>{order.shippingFee === 0 ? 'Free' : formatPrice(order.shippingFee)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-text-primary">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <Link href="/account/orders">
          <Button>View order history</Button>
        </Link>
        <Link href="/products" className="flex items-center text-sm font-medium text-primary hover:text-primary-hover">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
