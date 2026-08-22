import type { CustomerDetail, CustomerSummary, PaginatedCustomers } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const customersApi = {
  list: (page = 1, pageSize = 20, q?: string): Promise<PaginatedCustomers> =>
    apiFetch<PaginatedCustomers>(
      `/admin/customers?page=${page}&pageSize=${pageSize}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      { auth: true },
    ),

  getById: (id: string): Promise<CustomerDetail> => apiFetch<CustomerDetail>(`/admin/customers/${id}`, { auth: true }),

  setBlocked: (id: string, isBlocked: boolean): Promise<CustomerSummary> =>
    apiFetch<CustomerSummary>(`/admin/customers/${id}/block`, { method: 'PATCH', body: { isBlocked }, auth: true }),
};
