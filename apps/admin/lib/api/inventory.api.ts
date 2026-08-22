import type { AdjustmentView, PaginatedInventory } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const inventoryApi = {
  list: (page = 1, pageSize = 20, q?: string): Promise<PaginatedInventory> =>
    apiFetch<PaginatedInventory>(
      `/admin/inventory?page=${page}&pageSize=${pageSize}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      { auth: true },
    ),

  listAdjustments: (variantId: string, page = 1, pageSize = 20): Promise<{ items: AdjustmentView[]; total: number }> =>
    apiFetch<{ items: AdjustmentView[]; total: number }>(
      `/admin/inventory/${variantId}/adjustments?page=${page}&pageSize=${pageSize}`,
      { auth: true },
    ),

  adjust: (variantId: string, change: number, note?: string): Promise<AdjustmentView> =>
    apiFetch<AdjustmentView>(`/admin/inventory/${variantId}/adjustments`, {
      method: 'POST',
      body: { change, note },
      auth: true,
    }),
};
