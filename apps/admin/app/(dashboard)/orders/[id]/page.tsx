'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AdminOrderDetail, OrderStatus } from '@ecommerce/shared-types';
import { Button } from '../../../../components/ui/Button';
import { OrderStatusBadge } from '../../../../components/orders/OrderStatusBadge';
import { ApiError } from '../../../../lib/api/client';
import { ordersApi } from '../../../../lib/api/orders.api';
import { resolveImageUrl } from '../../../../lib/utils/image-url';
import { formatIncludedGst, formatPrice } from '../../../../lib/utils/format-price';

// Mirrors the backend's ADMIN_ALLOWED_TRANSITIONS map — kept as UI guidance
// only, the API is the actual authority and re-validates every request.
const NEXT_STATUS_OPTIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Payment pending',
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ordersApi
      .getById(params.id)
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
  }, [params.id]);

  async function handleStatusChange(next: OrderStatus) {
    if (!order) return;
    if (
      (next === 'CANCELLED' || next === 'RETURNED') &&
      !window.confirm(`Mark this order as ${STATUS_LABEL[next]}? This will restock its items.`)
    ) {
      return;
    }
    setUpdating(true);
    setError('');
    try {
      const updated = await ordersApi.updateStatus(order.id, next);
      setOrder(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update order status.');
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading order…</p>;
  }
  if (error && !order) {
    return (
      <div>
        <p className="text-sm text-danger">{error}</p>
        <Link href="/orders" className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary-hover">
          ← Back to orders
        </Link>
      </div>
    );
  }
  if (!order) return null;

  const nextOptions = NEXT_STATUS_OPTIONS[order.status];

  return (
    <div>
      <Link href="/orders" className="text-xs text-text-secondary hover:text-text-primary">
        ← Back to orders
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{order.orderNumber}</h1>
          <p className="mt-1 text-xs text-text-secondary">
            {order.customerName ?? order.customerEmail} · {order.customerEmail} ·{' '}
            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <Link href={`/orders/${order.id}/invoice`} target="_blank" className="text-sm font-medium text-primary hover:text-primary-hover">
            View invoice
          </Link>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {nextOptions.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-4">
          <span className="text-xs font-medium text-text-secondary">Move to:</span>
          {nextOptions.map((next) => (
            <Button
              key={next}
              type="button"
              variant={next === 'CANCELLED' || next === 'RETURNED' ? 'danger' : 'primary'}
              className="h-9 px-3 text-xs"
              disabled={updating}
              onClick={() => handleStatusChange(next)}
            >
              {STATUS_LABEL[next]}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-background p-6">
        <h2 className="mb-4 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Items</h2>
        <ul className="flex flex-col gap-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4">
              <div className="h-16 w-14 flex-shrink-0 overflow-hidden rounded bg-surface">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveImageUrl(item.imageUrl)} alt={item.productName} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{item.productName}</p>
                <p className="text-xs text-text-secondary">
                  {item.variantName} · Qty {item.quantity} · SKU {item.sku}
                </p>
              </div>
              <p className="text-sm font-semibold text-text-primary">{formatPrice(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-1 border-t border-border pt-4 text-sm">
          <div className="flex justify-between text-text-secondary">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          {order.discount > 0 ? (
            <div className="flex justify-between text-success">
              <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
              <span>−{formatPrice(order.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-text-secondary">
            <span>Shipping</span>
            <span>{order.shippingFee === 0 ? 'Free' : formatPrice(order.shippingFee)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-text-primary">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
          {order.taxAmount > 0 ? (
            // Prices are tax-inclusive: this is the GST inside the total, not added to it.
            <p className="text-right text-2xs text-text-secondary">{formatIncludedGst(order.taxAmount, order.taxRatePercent)}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-6">
          <h2 className="mb-3 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Shipping address</h2>
          <p className="text-sm text-text-primary">{order.shippingAddress.fullName}</p>
          <p className="text-sm text-text-secondary">{order.shippingAddress.phone}</p>
          <p className="text-sm text-text-secondary">
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
            {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-6">
          <h2 className="mb-3 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Payment</h2>
          <p className="text-sm text-text-primary">{order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Razorpay'}</p>
          <p className="text-sm text-text-secondary">Payment status: {order.paymentStatus}</p>
        </div>
      </div>
    </div>
  );
}
