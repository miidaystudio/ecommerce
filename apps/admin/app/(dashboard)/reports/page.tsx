'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  BestSellersReport,
  CustomerReport,
  ReportGroupBy,
  SalesReport,
} from '@ecommerce/shared-types';
import { Button } from '../../../components/ui/Button';
import { ApiError, apiDownload } from '../../../lib/api/client';
import { reportsApi, type ReportRange } from '../../../lib/api/reports.api';
import { formatPrice } from '../../../lib/utils/format-price';

type Tab = 'sales' | 'best-sellers' | 'customers';

const TABS: { label: string; value: Tab }[] = [
  { label: 'Sales', value: 'sales' },
  { label: 'Best sellers', value: 'best-sellers' },
  { label: 'Customers', value: 'customers' },
];

const GROUP_BY: ReportGroupBy[] = ['day', 'week', 'month'];

/** YYYY-MM-DD, which is what <input type="date"> expects. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: isoDate(from), to: isoDate(to) };
}

function formatPeriod(period: string, groupBy: ReportGroupBy): string {
  if (groupBy === 'month') {
    const [year, month] = period.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
    });
  }
  const label = new Date(period).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return groupBy === 'week' ? `Week of ${label}` : label;
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-text-primary">{value}</p>
      {hint ? <p className="mt-0.5 text-2xs text-text-secondary">{hint}</p> : null}
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('sales');
  const [range, setRange] = useState(defaultRange);
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('day');

  const [sales, setSales] = useState<SalesReport | null>(null);
  const [bestSellers, setBestSellers] = useState<BestSellersReport | null>(null);
  const [customers, setCustomers] = useState<CustomerReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const queryRange: ReportRange = { from: range.from, to: range.to };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (tab === 'sales') {
          const result = await reportsApi.sales({ ...queryRange, groupBy });
          if (!cancelled) setSales(result);
        } else if (tab === 'best-sellers') {
          const result = await reportsApi.bestSellers({ ...queryRange, limit: 20 });
          if (!cancelled) setBestSellers(result);
        } else {
          const result = await reportsApi.customers({ ...queryRange, limit: 20 });
          if (!cancelled) setCustomers(result);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load the report');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, range.from, range.to, groupBy]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setError('');
    try {
      const path = reportsApi.downloadCsv(tab, tab === 'sales' ? { ...queryRange, groupBy } : queryRange);
      await apiDownload(path, `miiday-${tab}-${range.from}-to-${range.to}.csv`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not export the report');
    } finally {
      setDownloading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, range.from, range.to, groupBy]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Reports</h1>
        <p className="mt-1.5 text-xs text-text-secondary">
          Confirmed orders onwards — pending, cancelled and returned orders are excluded.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={`h-9 rounded border px-3.5 text-xs font-medium transition ${
                tab === item.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-text-secondary hover:border-primary/40 hover:text-text-primary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary">From</span>
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))}
              className="h-9 rounded border border-border bg-background px-2.5 text-xs text-text-primary outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary">To</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))}
              className="h-9 rounded border border-border bg-background px-2.5 text-xs text-text-primary outline-none focus:border-primary"
            />
          </label>

          {tab === 'sales' ? (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary">Group by</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as ReportGroupBy)}
                className="h-9 rounded border border-border bg-background px-2.5 text-xs text-text-primary outline-none focus:border-primary"
              >
                {GROUP_BY.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            className="h-9 px-3 text-xs"
            disabled={downloading || loading}
            onClick={handleDownload}
          >
            {downloading ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <p className="rounded-lg border border-border bg-background px-4 py-10 text-center text-sm text-text-secondary">
          Loading report…
        </p>
      ) : tab === 'sales' && sales ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Net revenue" value={formatPrice(sales.totals.netRevenue)} />
            <StatTile label="Orders" value={String(sales.totals.orderCount)} />
            <StatTile label="Avg order value" value={formatPrice(sales.totals.avgOrderValue)} />
            <StatTile label="Units sold" value={String(sales.totals.unitsSold)} />
            <StatTile label="Gross revenue" value={formatPrice(sales.totals.grossRevenue)} hint="Before discounts" />
            <StatTile label="Discounts" value={formatPrice(sales.totals.discount)} />
            <StatTile label="Shipping collected" value={formatPrice(sales.totals.shipping)} />
            <StatTile
              label="Reconciles"
              value={formatPrice(
                sales.totals.grossRevenue - sales.totals.discount + sales.totals.shipping,
              )}
              hint="Gross − discounts + shipping"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-surface text-2xs uppercase tracking-[0.1em] text-text-secondary">
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Orders</th>
                    <th className="px-4 py-3 font-medium">Gross</th>
                    <th className="px-4 py-3 font-medium">Discount</th>
                    <th className="px-4 py-3 font-medium">Shipping</th>
                    <th className="px-4 py-3 font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.buckets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-text-secondary">
                        No orders in this period.
                      </td>
                    </tr>
                  ) : (
                    sales.buckets.map((bucket) => (
                      <tr key={bucket.period} className="border-b border-border last:border-0 hover:bg-surface">
                        <td className="px-4 py-3 text-sm text-text-primary">
                          {formatPeriod(bucket.period, sales.groupBy)}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{bucket.orderCount}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{formatPrice(bucket.grossRevenue)}</td>
                        <td className="px-4 py-3 text-sm text-success">
                          {bucket.discount > 0 ? `−${formatPrice(bucket.discount)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{formatPrice(bucket.shipping)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                          {formatPrice(bucket.netRevenue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : tab === 'best-sellers' && bestSellers ? (
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface text-2xs uppercase tracking-[0.1em] text-text-secondary">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Units sold</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-text-secondary">
                      Nothing sold in this period.
                    </td>
                  </tr>
                ) : (
                  bestSellers.items.map((item, index) => (
                    <tr key={item.productName} className="border-b border-border last:border-0 hover:bg-surface">
                      <td className="px-4 py-3 font-mono text-2xs text-text-secondary">
                        {String(index + 1).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">{item.productName}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{item.unitsSold}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                        {formatPrice(item.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'customers' && customers ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Customers who ordered" value={String(customers.totals.customersWithOrders)} />
            <StatTile label="New customers" value={String(customers.totals.newCustomers)} hint="Registered in period" />
            <StatTile label="Returning" value={String(customers.totals.returningCustomers)} hint="More than one order" />
            <StatTile label="Repeat rate" value={`${customers.totals.repeatRate}%`} />
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-surface text-2xs uppercase tracking-[0.1em] text-text-secondary">
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Orders</th>
                    <th className="px-4 py-3 font-medium">Total spend</th>
                    <th className="px-4 py-3 font-medium">Avg order</th>
                    <th className="px-4 py-3 font-medium">Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-secondary">
                        No customer orders in this period.
                      </td>
                    </tr>
                  ) : (
                    customers.items.map((row) => (
                      <tr key={row.userId} className="border-b border-border last:border-0 hover:bg-surface">
                        <td className="px-4 py-3">
                          <div className="text-sm text-text-primary">{row.name ?? row.email}</div>
                          {row.name ? <div className="text-2xs text-text-secondary">{row.email}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{row.orderCount}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                          {formatPrice(row.totalSpend)}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{formatPrice(row.avgOrderValue)}</td>
                        <td className="px-4 py-3 font-mono text-2xs text-text-secondary">
                          {new Date(row.lastOrderAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
