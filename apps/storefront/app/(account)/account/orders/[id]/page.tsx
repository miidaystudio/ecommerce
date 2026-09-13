'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { OrderDetail } from '@ecommerce/shared-types';
import { IncludedGst } from '../../../../../components/checkout/IncludedGst';
import { Button } from '../../../../../components/ui/Button';
import { OrderStatusBadge } from '../../../../../components/orders/OrderStatusBadge';
import { ApiError } from '../../../../../lib/api/client';
import { ordersApi } from '../../../../../lib/api/orders.api';
import { useAuth } from '../../../../../lib/hooks/useAuth';
import { useRazorpayCheckout } from '../../../../../lib/hooks/useRazorpayCheckout';
import { formatPrice } from '../../../../../lib/utils/format-price';
import { resolveImageUrl } from '../../../../../lib/utils/image-url';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { status, user } = useAuth();
  const razorpayCheckout = useRazorpayCheckout();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
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
  }, [status, params.id]);

  async function handleCancel() {
    if (!order) return;
    if (!window.confirm('Cancel this order?')) return;
    setCancelling(true);
    setError('');
    try {
      const updated = await ordersApi.cancel(order.id);
      setOrder(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel this order.');
    } finally {
      setCancelling(false);
    }
  }

  async function handleRetryPayment() {
    if (!order) return;
    setRetrying(true);
    setError('');
    setNotice('');
    try {
      const result = await ordersApi.retryPayment(order.id);
      if (!result.razorpay) return;

      await razorpayCheckout.open({
        keyId: result.razorpay.keyId,
        razorpayOrderId: result.razorpay.razorpayOrderId,
        amount: result.razorpay.amount,
        currency: result.razorpay.currency,
        orderNumber: result.order.orderNumber,
        prefill: {
          name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || undefined,
          email: user?.email,
          contact: user?.phone ?? undefined,
        },
        onSuccess: async (response) => {
          try {
            const confirmed = await ordersApi.verifyPayment(order.id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setOrder(confirmed);
          } catch {
            setNotice("We're confirming your payment — refresh this page shortly.");
          }
        },
        onDismiss: () => {
          setNotice('Payment was not completed. You can retry again below.');
        },
        onFailure: (description) => {
          setNotice(`Payment failed: ${description}. You can retry again below.`);
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start payment retry.');
    } finally {
      setRetrying(false);
    }
  }

  if (status !== 'authenticated' || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-text-secondary">Loading order…</p>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-danger">{error}</p>
        <Link href="/account/orders" className="text-sm font-medium text-primary hover:text-primary-hover">
          Back to order history
        </Link>
      </main>
    );
  }

  if (!order) return null;

  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';
  const canRetryPayment = order.paymentMethod === 'RAZORPAY' && order.status === 'PENDING';

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/account/orders" className="text-xs text-text-secondary hover:text-text-primary">
        ← Back to order history
      </Link>

      <div className="mt-4 mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Placed {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {notice ? <div className="mb-6 rounded-lg border border-border bg-surface p-4 text-sm text-text-primary">{notice}</div> : null}
      {error ? <p className="mb-6 text-sm text-danger">{error}</p> : null}

      <div className="rounded-lg border border-border bg-background p-6">
        <h2 className="mb-4 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Items</h2>
        <ul className="flex flex-col gap-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4">
              <div className="h-16 w-14 flex-shrink-0 overflow-hidden rounded bg-surface">
                {item.imageUrl ? (
                  <Image
                    src={resolveImageUrl(item.imageUrl)}
                    alt={item.productName}
                    width={56}
                    height={64}
                    sizes="56px"
                    className="h-full w-full object-cover"
                  />
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
          <IncludedGst taxAmount={order.taxAmount} taxRatePercent={order.taxRatePercent} />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-background p-6">
        <h2 className="mb-3 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
          Shipping address
        </h2>
        <p className="text-sm text-text-primary">{order.shippingAddress.fullName}</p>
        <p className="text-sm text-text-secondary">{order.shippingAddress.phone}</p>
        <p className="text-sm text-text-secondary">
          {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.city},{' '}
          {order.shippingAddress.state} {order.shippingAddress.postalCode}, {order.shippingAddress.country}
        </p>
      </div>

      {(canCancel || canRetryPayment) ? (
        <div className="mt-6 flex gap-3">
          {canRetryPayment ? (
            <Button onClick={handleRetryPayment} disabled={retrying}>
              {retrying ? 'Opening payment…' : 'Retry payment'}
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="danger" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
