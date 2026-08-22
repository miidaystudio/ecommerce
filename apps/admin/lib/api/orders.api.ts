import type { AdminOrderDetail, OrderStatus, PaginatedAdminOrders } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface ListAdminOrdersParams {
  page?: number;
  pageSize?: number;
  status?: OrderStatus;
  q?: string;
}

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const ordersApi = {
  list: (params: ListAdminOrdersParams = {}): Promise<PaginatedAdminOrders> =>
    apiFetch<PaginatedAdminOrders>(`/admin/orders${toQueryString(params)}`, { auth: true }),

  getById: (id: string): Promise<AdminOrderDetail> => apiFetch<AdminOrderDetail>(`/admin/orders/${id}`, { auth: true }),

  updateStatus: (id: string, status: OrderStatus): Promise<AdminOrderDetail> =>
    apiFetch<AdminOrderDetail>(`/admin/orders/${id}/status`, { method: 'PATCH', body: { status }, auth: true }),
};
