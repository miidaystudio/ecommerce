import type { PaginatedResponse, ProductDetail, ProductSummary } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface ListProductsParams {
  page?: number;
  pageSize?: number;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  q?: string;
}

function toQueryString<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, unknown][]) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const productsApi = {
  list: (params: ListProductsParams = {}): Promise<PaginatedResponse<ProductSummary>> =>
    apiFetch<PaginatedResponse<ProductSummary>>(`/products${toQueryString(params)}`),

  search: (q: string): Promise<ProductSummary[]> =>
    apiFetch<ProductSummary[]>(`/products/search${toQueryString({ q })}`),

  getBySlug: (slug: string): Promise<ProductDetail> =>
    apiFetch<ProductDetail>(`/products/${encodeURIComponent(slug)}`),

  related: (slug: string): Promise<ProductSummary[]> =>
    apiFetch<ProductSummary[]>(`/products/${encodeURIComponent(slug)}/related`),

  // Ids come from the viewer's own localStorage history, most recent first; the
  // API caps how many it will resolve and only returns ACTIVE products.
  recentlyViewed: (ids: string[]): Promise<ProductSummary[]> =>
    ids.length === 0
      ? Promise.resolve([])
      : apiFetch<ProductSummary[]>(`/products/recently-viewed${toQueryString({ ids: ids.join(',') })}`),
};
