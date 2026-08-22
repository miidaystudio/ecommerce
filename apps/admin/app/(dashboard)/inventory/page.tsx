'use client';

import { useEffect, useState } from 'react';
import type { InventoryLineView } from '@ecommerce/shared-types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api/client';
import { inventoryApi } from '../../../lib/api/inventory.api';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';

const PAGE_SIZE = 20;

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryLineView[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await inventoryApi.list(page, PAGE_SIZE, debouncedSearch || undefined);
        if (!cancelled) {
          setItems(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages || 1);
          setLowStockCount(result.lowStockCount);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load inventory');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, reloadTick]);

  function openAdjust(variantId: string) {
    setAdjustingId(variantId);
    setAdjustAmount('');
    setAdjustNote('');
  }

  async function submitAdjust(variantId: string) {
    const change = Number(adjustAmount);
    if (!Number.isInteger(change) || change === 0) {
      setError('Enter a non-zero whole number to adjust stock by.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await inventoryApi.adjust(variantId, change, adjustNote || undefined);
      setAdjustingId(null);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not apply adjustment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Inventory</h1>
          <p className="mt-1.5 text-xs text-text-secondary">
            {total} variant{total === 1 ? '' : 's'}
            {lowStockCount > 0 ? ` · ${lowStockCount} low on stock` : ''}
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product or SKU…"
          className="h-10 w-full rounded border border-border bg-background px-3.5 text-sm text-text-primary outline-none focus:border-primary sm:w-64"
        />
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-surface text-2xs uppercase tracking-[0.1em] text-text-secondary">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Variant</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-secondary">
                    Loading inventory…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-secondary">
                    No variants found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.variantId} className="border-b border-border last:border-0 hover:bg-surface">
                    <td className="px-4 py-3 text-sm text-text-primary">{item.productName}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{item.variantName}</td>
                    <td className="px-4 py-3 font-mono text-2xs text-text-secondary">{item.sku}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{item.stock}</span>
                        {item.lowStock ? <Badge tone="warning">Low stock</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {adjustingId === item.variantId ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            value={adjustAmount}
                            onChange={(e) => setAdjustAmount(e.target.value)}
                            placeholder="±qty"
                            className="h-9 w-20 rounded border border-border bg-background px-2 text-sm text-text-primary outline-none focus:border-primary"
                          />
                          <input
                            value={adjustNote}
                            onChange={(e) => setAdjustNote(e.target.value)}
                            placeholder="Note (optional)"
                            className="h-9 w-40 rounded border border-border bg-background px-2 text-sm text-text-primary outline-none focus:border-primary"
                          />
                          <Button
                            type="button"
                            className="h-9 px-3 text-xs"
                            disabled={saving}
                            onClick={() => submitAdjust(item.variantId)}
                          >
                            Save
                          </Button>
                          <button
                            type="button"
                            onClick={() => setAdjustingId(null)}
                            className="text-xs text-text-secondary hover:text-text-primary"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openAdjust(item.variantId)}
                          className="text-xs font-medium text-primary hover:text-primary-hover"
                        >
                          Adjust stock
                        </button>
                      )}
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
