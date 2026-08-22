'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AdminOrderDetail } from '@ecommerce/shared-types';
import { ApiError } from '../../../../lib/api/client';
import { ordersApi } from '../../../../lib/api/orders.api';
import { formatPrice } from '../../../../lib/utils/format-price';

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    ordersApi
      .getById(params.id)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this order.'));
  }, [params.id]);

  if (error) {
    return <p className="p-10 text-sm text-danger">{error}</p>;
  }
  if (!order) {
    return <p className="p-10 text-sm text-text-secondary">Loading invoice…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl bg-background p-10 print:p-0">
      <div className="mb-10 flex items-start justify-between">
        <div>
          <div className="text-lg font-bold tracking-tight text-text-primary">
            miiday<span className="text-accent">.</span>
          </div>
          <p className="mt-1 text-xs text-text-secondary">Tax Invoice</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium text-text-primary">{order.orderNumber}</p>
          <p className="text-text-secondary">
            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Billed to</p>
          <p className="mt-2 font-medium text-text-primary">{order.customerName ?? order.shippingAddress.fullName}</p>
          <p className="text-text-secondary">{order.customerEmail}</p>
        </div>
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Ship to</p>
          <p className="mt-2 text-text-primary">{order.shippingAddress.fullName}</p>
          <p className="text-text-secondary">{order.shippingAddress.phone}</p>
          <p className="text-text-secondary">
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
            {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
          </p>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-2xs uppercase tracking-[0.1em] text-text-secondary">
            <th className="py-2">Item</th>
            <th className="py-2">SKU</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-border">
              <td className="py-3">
                <p className="font-medium text-text-primary">{item.productName}</p>
                <p className="text-xs text-text-secondary">{item.variantName}</p>
              </td>
              <td className="py-3 text-text-secondary">{item.sku}</td>
              <td className="py-3 text-right text-text-secondary">{item.quantity}</td>
              <td className="py-3 text-right text-text-secondary">{formatPrice(item.price)}</td>
              <td className="py-3 text-right font-medium text-text-primary">{formatPrice(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-56 text-sm">
          <div className="flex justify-between py-1 text-text-secondary">
            <span>Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between py-1 text-text-secondary">
            <span>Shipping</span>
            <span>{order.shippingFee === 0 ? 'Free' : formatPrice(order.shippingFee)}</span>
          </div>
          <div className="flex justify-between border-t border-border py-2 text-base font-semibold text-text-primary">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-10 flex justify-between border-t border-border pt-4 text-2xs text-text-secondary print:hidden">
        <span>Payment method: {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Razorpay'}</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded border border-border px-3 py-1.5 font-medium text-text-primary hover:border-primary/40"
        >
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
