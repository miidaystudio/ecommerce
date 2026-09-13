import type { BestSellersReport, CustomerReport, ReportGroupBy, SalesReport } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface ReportRange {
  from?: string;
  to?: string;
  groupBy?: ReportGroupBy;
  limit?: number;
}

function toQuery(range: ReportRange): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(range)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const reportsApi = {
  sales: (range: ReportRange = {}): Promise<SalesReport> =>
    apiFetch<SalesReport>(`/admin/reports/sales${toQuery(range)}`, { auth: true }),

  bestSellers: (range: ReportRange = {}): Promise<BestSellersReport> =>
    apiFetch<BestSellersReport>(`/admin/reports/best-sellers${toQuery(range)}`, { auth: true }),

  customers: (range: ReportRange = {}): Promise<CustomerReport> =>
    apiFetch<CustomerReport>(`/admin/reports/customers${toQuery(range)}`, { auth: true }),

  // CSV needs the auth header, so it cannot be a plain <a href>. The response
  // is fetched as a blob and handed to the browser as a download.
  downloadCsv: (report: 'sales' | 'best-sellers' | 'customers', range: ReportRange = {}): string =>
    `/admin/reports/${report}.csv${toQuery(range)}`,
};
