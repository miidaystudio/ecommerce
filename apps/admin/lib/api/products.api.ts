import type { PaginatedResponse, ProductDetail, ProductStatus, ProductSummary } from '@ecommerce/shared-types';
import { apiFetch, apiUpload } from './client';

export interface ListAdminProductsParams {
  page?: number;
  pageSize?: number;
  status?: ProductStatus;
  q?: string;
}

export interface ProductVariantInput {
  id?: string;
  sku: string;
  name: string;
  attributes?: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  isDefault?: boolean;
}

export interface CreateProductPayload {
  name: string;
  slug?: string;
  description: string;
  status?: ProductStatus;
  categoryId: string;
  brandId?: string;
  seoTitle?: string;
  seoDescription?: string;
  variants: ProductVariantInput[];
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

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

export const productsApi = {
  listAdmin: (params: ListAdminProductsParams = {}): Promise<PaginatedResponse<ProductSummary>> =>
    apiFetch<PaginatedResponse<ProductSummary>>(`/admin/products${toQueryString(params)}`, { auth: true }),

  getById: (id: string): Promise<ProductDetail> =>
    apiFetch<ProductDetail>(`/admin/products/${id}`, { auth: true }),

  create: (payload: CreateProductPayload): Promise<ProductDetail> =>
    apiFetch<ProductDetail>('/admin/products', { method: 'POST', body: payload, auth: true }),

  update: (id: string, payload: UpdateProductPayload): Promise<ProductDetail> =>
    apiFetch<ProductDetail>(`/admin/products/${id}`, { method: 'PATCH', body: payload, auth: true }),

  remove: (id: string): Promise<{ success: true }> =>
    apiFetch<{ success: true }>(`/admin/products/${id}`, { method: 'DELETE', auth: true }),

  uploadImage: (id: string, file: File): Promise<ProductDetail> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload<ProductDetail>(`/admin/products/${id}/images`, { formData, auth: true });
  },

  removeImage: (id: string, imageId: string): Promise<ProductDetail> =>
    apiFetch<ProductDetail>(`/admin/products/${id}/images/${imageId}`, { method: 'DELETE', auth: true }),
};
