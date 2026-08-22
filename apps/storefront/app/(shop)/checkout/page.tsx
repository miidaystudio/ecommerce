'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PaymentMethod, UserAddress } from '@ecommerce/shared-types';
import { AddressForm } from '../../../components/checkout/AddressForm';
import { Button } from '../../../components/ui/Button';
import { addressesApi } from '../../../lib/api/addresses.api';
import { ApiError } from '../../../lib/api/client';
import { ordersApi } from '../../../lib/api/orders.api';
import { useAuth } from '../../../lib/hooks/useAuth';
import { useRazorpayCheckout } from '../../../lib/hooks/useRazorpayCheckout';
import { formatPrice } from '../../../lib/utils/format-price';
import { resolveImageUrl } from '../../../lib/utils/image-url';
import { selectSubtotal, useCartStore } from '../../../store/cartStore';

export default function CheckoutPage() {
  const router = useRouter();
  const { status, user } = useAuth();
  const razorpayCheckout = useRazorpayCheckout();

  const items = useCartStore((s) => s.items);
  const subtotal = selectSubtotal(items);

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('RAZORPAY');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string[]>([]);
  const [paymentNotice, setPaymentNotice] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?next=/checkout');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (items.length === 0) {
      router.replace('/cart');
      return;
    }
    let cancelled = false;
    async function load() {
      setAddressesLoading(true);
      try {
        const list = await addressesApi.list();
        if (cancelled) return;
        setAddresses(list);
        const defaultAddress = list.find((a) => a.isDefault) ?? list[0];
        if (defaultAddress) setSelectedAddressId(defaultAddress.id);
        if (list.length === 0) setShowAddForm(true);
      } catch {
        if (!cancelled) setError(['Could not load your saved addresses.']);
      } finally {
        if (!cancelled) setAddressesLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function handleAddressSaved(address: UserAddress) {
    setAddresses((prev) => {
      const exists = prev.some((a) => a.id === address.id);
      return exists ? prev.map((a) => (a.id === address.id ? address : a)) : [...prev, address];
    });
    setSelectedAddressId(address.id);
    setShowAddForm(false);
  }

  async function handlePlaceOrder() {
    if (!selectedAddressId) {
      setError(['Choose or add a delivery address first.']);
      return;
    }
    setError([]);
    setPaymentNotice('');
    setPlacing(true);

    try {
      const result = await ordersApi.create(selectedAddressId, paymentMethod);

      if (!result.razorpay) {
        // COD — already CONFIRMED server-side.
        useCartStore.setState({ items: [] });
        router.push(`/checkout/success?orderId=${result.order.id}`);
        return;
      }

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
            await ordersApi.verifyPayment(result.order.id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            useCartStore.setState({ items: [] });
            router.push(`/checkout/success?orderId=${result.order.id}`);
          } catch {
            // Rare: verify-payment's signature check failed even though Checkout.js
            // reported success. The webhook may still confirm it independently —
            // don't claim outright failure, point them to order history instead.
            setPaymentNotice(
              "We're confirming your payment — this can take a moment. Check your order history shortly.",
            );
            router.push('/account/orders');
          }
        },
        onDismiss: () => {
          setPaymentNotice('Payment was not completed. Your order is saved — you can retry payment from your order history.');
          router.push(`/account/orders/${result.order.id}`);
        },
        onFailure: (description) => {
          setPaymentNotice(`Payment failed: ${description}. You can retry from your order history.`);
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(Array.isArray(err.message) ? err.message : [err.message]);
      } else {
        setError(['Something went wrong placing your order. Please try again.']);
      }
    } finally {
      setPlacing(false);
    }
  }

  if (status !== 'authenticated' || items.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-text-secondary">Loading checkout…</p>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Checkout</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">Checkout</h1>
      </div>

      {paymentNotice ? (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4 text-sm text-text-primary">
          {paymentNotice}
        </div>
      ) : null}
      {error.length > 0 ? (
        <div className="mb-6 rounded-lg border border-danger/30 bg-danger/10 p-4">
          <p className="text-sm font-medium text-danger">Some items in your cart need attention:</p>
          <ul className="mt-1 list-inside list-disc text-sm text-danger">
            {error.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Delivery address
            </h2>

            {addressesLoading ? (
              <p className="text-sm text-text-secondary">Loading addresses…</p>
            ) : (
              <div className="flex flex-col gap-3">
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                      selectedAddressId === address.id ? 'border-primary bg-surface' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      className="mt-1"
                      checked={selectedAddressId === address.id}
                      onChange={() => setSelectedAddressId(address.id)}
                    />
                    <div className="text-sm">
                      <p className="font-medium text-text-primary">
                        {address.fullName} {address.isDefault ? <span className="text-2xs text-accent">· Default</span> : null}
                      </p>
                      <p className="text-text-secondary">{address.phone}</p>
                      <p className="text-text-secondary">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.postalCode}
                      </p>
                    </div>
                  </label>
                ))}

                {!showAddForm ? (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="w-fit text-sm font-medium text-primary hover:text-primary-hover"
                  >
                    + Add a new address
                  </button>
                ) : (
                  <div className="rounded-lg border border-border bg-surface p-5">
                    <AddressForm
                      onSaved={handleAddressSaved}
                      onCancel={addresses.length > 0 ? () => setShowAddForm(false) : undefined}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Shipping
            </h2>
            <p className="text-sm text-text-secondary">
              Free shipping on orders over ₹999 · exact shipping is calculated at checkout.
            </p>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Payment</h2>
            <div className="flex flex-col gap-3">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${
                  paymentMethod === 'RAZORPAY' ? 'border-primary bg-surface' : 'border-border hover:border-primary/40'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'RAZORPAY'}
                  onChange={() => setPaymentMethod('RAZORPAY')}
                />
                <div className="text-sm">
                  <p className="font-medium text-text-primary">Cards, UPI, Netbanking &amp; Wallets</p>
                  <p className="text-text-secondary">Pay securely via Razorpay.</p>
                </div>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${
                  paymentMethod === 'COD' ? 'border-primary bg-surface' : 'border-border hover:border-primary/40'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 'COD'}
                  onChange={() => setPaymentMethod('COD')}
                />
                <div className="text-sm">
                  <p className="font-medium text-text-primary">Cash on delivery</p>
                  <p className="text-text-secondary">Pay when your order arrives.</p>
                </div>
              </label>
            </div>
          </section>
        </div>

        <div className="h-fit rounded-lg border border-border bg-surface p-5 shadow-card">
          <h2 className="mb-4 text-sm font-medium text-text-primary">Order summary</h2>
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.variantId} className="flex gap-3">
                <div className="h-14 w-12 flex-shrink-0 overflow-hidden rounded bg-background">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImageUrl(item.image.url)}
                      alt={item.image.altText ?? item.product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 text-xs">
                  <p className="font-medium text-text-primary">{item.product.name}</p>
                  <p className="text-text-secondary">{item.variant.name} · Qty {item.quantity}</p>
                </div>
                <p className="text-xs font-semibold text-text-primary">{formatPrice(item.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
            <span className="text-text-secondary">Subtotal</span>
            <span className="font-semibold text-text-primary">{formatPrice(subtotal)}</span>
          </div>
          <p className="mt-1 text-2xs text-text-secondary">Shipping and final total shown on payment.</p>

          <Button onClick={handlePlaceOrder} disabled={placing || !selectedAddressId} className="mt-5 w-full">
            {placing ? 'Placing order…' : 'Place order'}
          </Button>
          <Link href="/cart" className="mt-3 block text-center text-xs text-text-secondary hover:text-text-primary">
            Back to cart
          </Link>
        </div>
      </div>
    </div>
  );
}
