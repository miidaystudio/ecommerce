'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DashboardSummary } from '@ecommerce/shared-types';
import { RevenueChart } from '../../components/dashboard/RevenueChart';
import { OrderStatusBadge } from '../../components/orders/OrderStatusBadge';
import { ApiError } from '../../lib/api/client';
import { dashboardApi } from '../../lib/api/dashboard.api';
import { useAuth } from '../../lib/hooks/useAuth';
import { formatPrice } from '../../lib/utils/format-price';

const RANGE_OPTIONS = [
  { days: 7 as const, label: 'Last 7 days' },
  { days: 30 as const, label: 'Last 30 days' },
  { days: 90 as const, label: 'Last 90 days' },
];

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.firstName || user?.email?.split('@')[0] || 'there';

  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    dashboardApi
      .getSummary(days)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const revenueTrend = summary ? pctChange(summary.revenue, summary.previousRevenue) : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Good day, {firstName}</h1>
          <p className="mt-1.5 text-xs text-text-secondary">Here&apos;s what&apos;s happening in your store today.</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}
          className="h-9 rounded border border-border bg-background px-3 text-sm text-text-primary outline-none focus:border-primary"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.days} value={opt.days}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {loading || !summary ? (
        <p className="text-sm text-text-secondary">Loading dashboard…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Revenue" value={formatPrice(summary.revenue)} trend={revenueTrend} />
            <StatCard label="Orders" value={String(summary.orderCount)} />
            <StatCard label="New customers" value={String(summary.newCustomerCount)} />
            <StatCard label="Avg. order value" value={formatPrice(summary.avgOrderValue)} />
          </div>

          {summary.lowStockCount > 0 ? (
            <Link
              href="/inventory"
              className="mt-4 flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 px-5 py-3 text-sm text-text-strong transition hover:border-warning"
            >
              <span>
                <strong className="font-semibold">{summary.lowStockCount}</strong> variant
                {summary.lowStockCount === 1 ? '' : 's'} running low on stock
              </span>
              <span className="text-xs font-medium">View inventory →</span>
            </Link>
          ) : null}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-lg border border-border bg-background p-5">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-text-primary">Revenue · {days} days</h2>
              </div>
              <RevenueChart data={summary.revenueByDay} />
            </div>

            <div className="rounded-lg border border-border bg-background p-5">
              <h2 className="mb-4 text-sm font-semibold text-text-primary">Top products</h2>
              {summary.topProducts.length === 0 ? (
                <p className="text-sm text-text-secondary">No sales in this period yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {summary.topProducts.map((p) => (
                    <li key={p.productName} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-text-primary">{p.productName}</p>
                        <p className="text-xs text-text-secondary">{p.quantitySold} sold</p>
                      </div>
                      <span className="font-semibold text-text-primary">{formatPrice(p.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-background p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Recent orders</h2>
              <Link href="/orders" className="text-xs font-medium text-primary hover:text-primary-hover">
                View all
              </Link>
            </div>
            {summary.recentOrders.length === 0 ? (
              <p className="text-sm text-text-secondary">No orders yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {summary.recentOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-4 py-3">
                    <Link href={`/orders/${o.id}`} className="text-sm font-medium text-text-primary hover:text-primary-hover">
                      {o.orderNumber}
                    </Link>
                    <span className="flex-1 truncate text-xs text-text-secondary">{o.customerEmail}</span>
                    <OrderStatusBadge status={o.status} />
                    <span className="w-20 text-right text-sm font-semibold text-text-primary">{formatPrice(o.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, trend }: { label: string; value: string; trend?: number | null }) {
  return (
    <div className="rounded-lg bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">{label}</span>
        {trend !== undefined && trend !== null ? (
          <span className={`rounded-full px-1.5 py-0.5 text-2xs ${trend >= 0 ? 'bg-success/15 text-success-strong' : 'bg-danger/15 text-danger-strong'}`}>
            {trend >= 0 ? '+' : ''}
            {trend.toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{value}</div>
    </div>
  );
}
