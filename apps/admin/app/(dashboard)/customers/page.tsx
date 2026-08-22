'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CustomerSummary } from '@ecommerce/shared-types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api/client';
import { customersApi } from '../../../lib/api/customers.api';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const [items, setItems] = useState<CustomerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await customersApi.list(page, PAGE_SIZE, debouncedSearch || undefined);
        if (!cancelled) {
          setItems(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages || 1);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load customers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch]);

  async function toggleBlocked(customer: CustomerSummary) {
    const action = customer.isBlocked ? 'unblock' : 'block';
    if (!window.confirm(`${action === 'block' ? 'Block' : 'Unblock'} ${customer.email}?`)) return;
    setBusyId(customer.id);
    try {
      const updated = await customersApi.setBlocked(customer.id, !customer.isBlocked);
      setItems((prev) => prev.map((c) => (c.id === customer.id ? updated : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this customer');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Customers</h1>
          <p className="mt-1.5 text-xs text-text-secondary">{total} customer{total === 1 ? '' : 's'}</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="h-10 w-full rounded border border-border bg-background px-3.5 text-sm text-text-primary outline-none focus:border-primary sm:w-64"
        />
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface text-2xs uppercase tracking-[0.1em] text-text-secondary">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-secondary">
                    Loading customers…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-secondary">
                    No customers found.
                  </td>
                </tr>
              ) : (
                items.map((customer) => (
                  <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-surface">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${customer.id}`} className="text-sm font-medium text-text-primary hover:text-primary-hover">
                        {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email}
                      </Link>
                      <div className="text-2xs text-text-secondary">{customer.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{customer.orderCount}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {new Date(customer.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={customer.isBlocked ? 'danger' : 'success'}>{customer.isBlocked ? 'Blocked' : 'Active'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        variant={customer.isBlocked ? 'secondary' : 'danger'}
                        className="h-8 px-3 text-xs"
                        disabled={busyId === customer.id}
                        onClick={() => toggleBlocked(customer)}
                      >
                        {customer.isBlocked ? 'Unblock' : 'Block'}
                      </Button>
                    </td>
                  </tr>
                ))
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
            <Button type="button" variant="secondary" className="h-9 px-3 text-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button type="button" variant="secondary" className="h-9 px-3 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
