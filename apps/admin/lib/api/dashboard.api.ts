import type { DashboardSummary } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const dashboardApi = {
  getSummary: (days: 7 | 30 | 90 = 30): Promise<DashboardSummary> =>
    apiFetch<DashboardSummary>(`/admin/dashboard/summary?days=${days}`, { auth: true }),
};
