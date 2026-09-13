'use client';

import { useEffect, useState } from 'react';
import type { CouponView } from '@ecommerce/shared-types';
import { CouponForm } from '../../../components/marketing/CouponForm';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api/client';
import { couponsApi } from '../../../lib/api/coupons.api';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import { formatPrice } from '../../../lib/utils/format-price';

const PAGE_SIZE = 20;

type CouponState = 'Active' | 'Inactive' | 'Scheduled' | 'Expired' | 'Used up';

// Mirrors the server-side checks in CouponsService.validateForUser so the list
// shows the same reason a redemption would be refused.
function couponState(coupon: CouponView): { label: CouponState; tone: BadgeTone } {
  if (!coupon.isActive) return { label: 'Inactive', tone: 'muted' };

  const now = Date.now();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
    return { label: 'Scheduled', tone: 'accent' };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now) {
    return { label: 'Expired', tone: 'danger' };
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { label: 'Used up', tone: 'danger' };
  }
  return { label: 'Active', tone: 'success' };
}

function formatDiscount(coupon: CouponView): string {
  if (coupon.discountType === 'PERCENTAGE') {
    const cap = coupon.maxDiscount !== null ? ` (max ${formatPrice(coupon.maxDiscount)})` : '';
    return `${coupon.discountValue}% off${cap}`;
  }
  return `${formatPrice(coupon.discountValue)} off`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CouponsPage() {
  const [items, setItems] = useState<CouponView[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CouponView | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await couponsApi.list(page, PAGE_SIZE, debouncedSearch || undefined);
        if (!cancelled) {
          setItems(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages || 1);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load coupons');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, reloadTick]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(coupon: CouponView) {
    setEditing(coupon);
    setFormOpen(true);
  }

  function handleSaved() {
    setFormOpen(false);
    setEditing(null);
    setReloadTick((t) => t + 1);
  }

  async function handleDelete(coupon: CouponView) {
    setDeletingId(coupon.id);
    setError('');
    try {
      await couponsApi.remove(coupon.id);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the coupon');
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(coupon: CouponView) {
    setError('');
    try {
      await couponsApi.update(coupon.id, { isActive: !coupon.isActive });
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the coupon');
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Coupons</h1>
          <p className="mt-1.5 text-xs text-text-secondary">
            {total} code{total === 1 ? '' : 's'} · discounts are recalculated server-side at checkout
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code…"
            className="h-10 w-full rounded border border-border bg-background px-3.5 text-sm text-text-primary outline-none focus:border-primary sm:w-56"
          />
          <Button type="button" onClick={openCreate}>
            New coupon
          </Button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {formOpen ? (
        <div className="mb-6">
          <CouponForm coupon={editing} onSaved={handleSaved} onCancel={() => setFormOpen(false)} />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface text-2xs uppercase tracking-[0.1em] text-text-secondary">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Min order</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-secondary">
                    Loading coupons…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-secondary">
                    No coupons yet. Create one to start running offers.
                  </td>
                </tr>
              ) : (
                items.map((coupon) => {
                  const state = couponState(coupon);
                  return (
                    <tr key={coupon.id} className="border-b border-border last:border-0 hover:bg-surface">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-semibold uppercase tracking-wide text-text-primary">
                          {coupon.code}
                        </div>
                        {coupon.description ? (
                          <div className="mt-0.5 max-w-xs truncate text-xs text-text-secondary">
                            {coupon.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">{formatDiscount(coupon)}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {coupon.minOrderValue !== null ? formatPrice(coupon.minOrderValue) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {coupon.usedCount}
                        {coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : ''}
                        {coupon.perUserLimit !== null ? (
                          <div className="text-2xs text-text-secondary">{coupon.perUserLimit} per customer</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {formatDate(coupon.startsAt)} → {formatDate(coupon.expiresAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(coupon)}
                            className="text-xs font-medium text-primary hover:text-primary-hover"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleActive(coupon)}
                            className="text-xs text-text-secondary hover:text-text-primary"
                          >
                            {coupon.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(coupon)}
                            disabled={deletingId === coupon.id}
                            className="text-xs text-danger hover:opacity-80 disabled:opacity-50"
                          >
                            {deletingId === coupon.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
