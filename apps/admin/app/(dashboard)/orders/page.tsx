'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AdminOrderSummary, OrderStatus } from '@ecommerce/shared-types';
import { Button } from '../../../components/ui/Button';
import { OrderStatusBadge } from '../../../components/orders/OrderStatusBadge';
import { ApiError } from '../../../lib/api/client';
import { ordersApi } from '../../../lib/api/orders.api';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import { formatPrice } from '../../../lib/utils/format-price';

const STATUS_TABS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'RETURNED', label: 'Returned' },
];

const PAGE_SIZE = 20;

export default function AdminOrdersPage() {
  const [items, setItems] = useState<AdminOrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await ordersApi.list({
          page,
          pageSize: PAGE_SIZE,
          status: status === 'ALL' ? undefined : status,
          q: debouncedSearch || undefined,
        });
        if (!cancelled) {
          setItems(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages || 1);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Unable to connect to order telemetry database.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [page, status, debouncedSearch, reloadKey]);

  return (
    <div className="font-sans">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-neutral-950">
            ORDERS
          </h1>
          <p className="font-mono text-xs text-neutral-500 mt-1">
            {total} RECORDED {total === 1 ? 'ORDER' : 'ORDERS'} IN SYSTEM
          </p>
        </div>

        {/* Search Input */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter order # or customer email…"
          className="h-9 w-full sm:w-72 rounded-full border border-neutral-200/80 bg-white px-4 text-xs font-mono text-neutral-900 placeholder-neutral-400 outline-none focus:border-neutral-950 transition-all shadow-2xs"
        />
      </div>

      {/* Status Filter Pill Row */}
      <div className="flex flex-wrap items-center gap-2 mt-4 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={
              status === tab.value
                ? 'bg-neutral-950 text-white rounded-full px-4 py-1.5 text-xs font-mono font-medium shadow-xs transition-colors'
                : 'bg-white hover:bg-neutral-100 text-neutral-600 rounded-full px-3.5 py-1.5 text-xs font-mono border border-neutral-200/80 transition-colors'
            }
          >
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Data Table Container */}
      <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F7F5F0] border-b border-neutral-200/70 text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
                <th className="py-3.5 px-6 font-semibold">ORDER</th>
                <th className="py-3.5 px-6 font-semibold">CUSTOMER</th>
                <th className="py-3.5 px-6 font-semibold">DATE</th>
                <th className="py-3.5 px-6 font-semibold">STATUS</th>
                <th className="py-3.5 px-6 font-semibold">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center font-mono text-xs text-neutral-400">
                    Fetching telemetry database records…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center text-sm font-mono">
                      !
                    </div>
                    <p className="text-xs font-mono text-neutral-600 max-w-sm">{error}</p>
                    <button
                      type="button"
                      onClick={() => setReloadKey((k) => k + 1)}
                      className="font-mono text-xs font-bold text-neutral-950 hover:text-emerald-600 uppercase tracking-wider bg-neutral-100 hover:bg-neutral-200 px-4 py-2 rounded-full border border-neutral-200 transition"
                    >
                      [ Retry Fetch ]
                    </button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center text-sm font-mono">
                      ∅
                    </div>
                    <p className="text-xs font-mono text-neutral-500">No order records match the active filter criteria.</p>
                  </td>
                </tr>
              ) : (
                items.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono text-xs">
                      <Link href={`/orders/${order.id}`} className="font-bold text-neutral-950 hover:text-emerald-600 transition-colors">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-neutral-600">{order.customerEmail}</td>
                    <td className="py-4 px-6 font-mono text-xs text-neutral-500">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-6">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-4 px-6 font-mono text-xs font-bold text-neutral-950">{formatPrice(order.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between font-mono text-xs text-neutral-500">
          <span>
            PAGE {page} OF {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-full bg-white border border-neutral-200/80 font-bold uppercase disabled:opacity-40 hover:bg-neutral-100 transition shadow-2xs"
            >
              PREVIOUS
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 rounded-full bg-white border border-neutral-200/80 font-bold uppercase disabled:opacity-40 hover:bg-neutral-100 transition shadow-2xs"
            >
              NEXT
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
