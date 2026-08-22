'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { CustomerDetail } from '@ecommerce/shared-types';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { ApiError } from '../../../../lib/api/client';
import { customersApi } from '../../../../lib/api/customers.api';
import { formatPrice } from '../../../../lib/utils/format-price';

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    customersApi
      .getById(params.id)
      .then((result) => {
        if (!cancelled) setCustomer(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load this customer.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function toggleBlocked() {
    if (!customer) return;
    const action = customer.isBlocked ? 'unblock' : 'block';
    if (!window.confirm(`${action === 'block' ? 'Block' : 'Unblock'} ${customer.email}?`)) return;
    setBusy(true);
    try {
      const updated = await customersApi.setBlocked(customer.id, !customer.isBlocked);
      setCustomer({ ...customer, isBlocked: updated.isBlocked });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this customer');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading customer…</p>;
  if (error && !customer) {
    return (
      <div>
        <p className="text-sm text-danger">{error}</p>
        <Link href="/customers" className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary-hover">
          ← Back to customers
        </Link>
      </div>
    );
  }
  if (!customer) return null;

  return (
    <div>
      <Link href="/customers" className="text-xs text-text-secondary hover:text-text-primary">
        ← Back to customers
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email}
          </h1>
          <p className="mt-1 text-xs text-text-secondary">
            {customer.email}
            {customer.phone ? ` · ${customer.phone}` : ''} · Joined{' '}
            {new Date(customer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={customer.isBlocked ? 'danger' : 'success'}>{customer.isBlocked ? 'Blocked' : 'Active'}</Badge>
          <Button type="button" variant={customer.isBlocked ? 'secondary' : 'danger'} disabled={busy} onClick={toggleBlocked}>
            {customer.isBlocked ? 'Unblock customer' : 'Block customer'}
          </Button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="rounded-lg border border-border bg-background p-6">
        <h2 className="mb-4 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
          Order history ({customer.orderCount})
        </h2>
        {customer.orders.length === 0 ? (
          <p className="text-sm text-text-secondary">No orders yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {customer.orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-4 py-3">
                <Link href={`/orders/${order.id}`} className="text-sm font-medium text-text-primary hover:text-primary-hover">
                  {order.orderNumber}
                </Link>
                <span className="text-xs text-text-secondary">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
                <span className="text-2xs uppercase tracking-wide text-text-secondary">{order.status}</span>
                <span className="text-sm font-semibold text-text-primary">{formatPrice(order.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
