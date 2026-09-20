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
  const firstName = user?.firstName || user?.email?.split('@')[0] || 'admin';

  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await dashboardApi.getSummary(days);
        if (!cancelled) {
          setSummary(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Unable to connect to dashboard telemetry database.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [days, reloadKey]);

  const revenueTrend = summary ? pctChange(summary.revenue, summary.previousRevenue) : null;

  return (
    <div className="font-sans">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-neutral-950">
            GOOD DAY, {firstName.toUpperCase()}
          </h1>
          <p className="font-mono text-xs text-neutral-500 mt-1">
            STORE METRICS &amp; TELEMETRY SUMMARY //
          </p>
        </div>

        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}
          className="h-9 rounded-full border border-neutral-200/80 bg-white px-4 text-xs font-mono text-neutral-900 outline-none focus:border-neutral-950 transition-all shadow-2xs cursor-pointer"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.days} value={opt.days}>
              {opt.label.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Main Content Area: Strict State Partitioning */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-neutral-200/90 p-16 text-center shadow-xs">
          <p className="font-mono text-xs text-neutral-400 animate-pulse">
            Fetching telemetry summary records…
          </p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-3xl border border-neutral-200/90 p-16 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center text-sm font-mono font-bold">
            !
          </div>
          <p className="text-xs font-mono text-neutral-600 max-w-sm">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="font-mono text-xs font-bold text-neutral-950 hover:text-emerald-600 uppercase tracking-wider bg-neutral-100 hover:bg-neutral-200 px-4 py-2 rounded-full border border-neutral-200 transition mt-1"
          >
            [ Retry Fetch ]
          </button>
        </div>
      ) : summary ? (
        <>
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="REVENUE" value={formatPrice(summary.revenue)} trend={revenueTrend} />
            <StatCard label="TOTAL ORDERS" value={String(summary.orderCount)} />
            <StatCard label="NEW CUSTOMERS" value={String(summary.newCustomerCount)} />
            <StatCard label="AVG ORDER VALUE" value={formatPrice(summary.avgOrderValue)} />
          </div>

          {/* Low Stock Banner */}
          {summary.lowStockCount > 0 ? (
            <Link
              href="/inventory"
              className="mt-5 flex items-center justify-between rounded-2xl bg-amber-500/10 border border-amber-500/30 px-5 py-3.5 text-xs font-mono text-amber-900 hover:bg-amber-500/20 transition-all shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>
                  <strong className="font-bold">{summary.lowStockCount}</strong> VARIANT
                  {summary.lowStockCount === 1 ? '' : 'S'} RUNNING LOW ON STOCK
                </span>
              </div>
              <span className="font-bold uppercase text-[11px] tracking-wider">VIEW INVENTORY →</span>
            </Link>
          ) : null}

          {/* Revenue Chart & Top Products */}
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-3xl border border-neutral-200/90 bg-white p-6 shadow-xs">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                  REVENUE TREND // {days} DAYS
                </h2>
              </div>
              <RevenueChart data={summary.revenueByDay} />
            </div>

            <div className="rounded-3xl border border-neutral-200/90 bg-white p-6 shadow-xs">
              <h2 className="mb-4 text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                TOP PRODUCTS
              </h2>
              {summary.topProducts.length === 0 ? (
                <p className="text-xs font-mono text-neutral-400 py-8 text-center">No sales in this period yet.</p>
              ) : (
                <ul className="flex flex-col gap-3 font-mono">
                  {summary.topProducts.map((p) => (
                    <li key={p.productName} className="flex items-center justify-between text-xs py-2 border-b border-neutral-100 last:border-0">
                      <div>
                        <p className="font-bold text-neutral-900">{p.productName}</p>
                        <p className="text-2xs text-neutral-500">{p.quantitySold} sold</p>
                      </div>
                      <span className="font-bold text-neutral-950">{formatPrice(p.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="mt-6 rounded-3xl border border-neutral-200/90 bg-white p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                RECENT ORDERS
              </h2>
              <Link href="/orders" className="font-mono text-xs font-bold text-neutral-950 hover:text-emerald-600 uppercase tracking-wider">
                VIEW ALL →
              </Link>
            </div>
            {summary.recentOrders.length === 0 ? (
              <p className="text-xs font-mono text-neutral-400 py-8 text-center">No orders recorded yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-neutral-100 font-mono">
                {summary.recentOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-4 py-3 hover:bg-neutral-50/50 px-2 rounded-xl transition-colors">
                    <Link href={`/orders/${o.id}`} className="text-xs font-bold text-neutral-950 hover:text-emerald-600 transition-colors">
                      {o.orderNumber}
                    </Link>
                    <span className="flex-1 truncate text-xs text-neutral-500">{o.customerEmail}</span>
                    <OrderStatusBadge status={o.status} />
                    <span className="w-24 text-right text-xs font-bold text-neutral-950">{formatPrice(o.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, trend }: { label: string; value: string; trend?: number | null }) {
  return (
    <div className="rounded-3xl border border-neutral-200/90 bg-white p-6 shadow-xs font-mono">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-bold uppercase tracking-wider text-neutral-500">{label}</span>
        {trend !== undefined && trend !== null ? (
          <span className={`rounded-full px-2 py-0.5 text-2xs font-bold ${trend >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {trend >= 0 ? '+' : ''}
            {trend.toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-neutral-950">{value}</div>
    </div>
  );
}
