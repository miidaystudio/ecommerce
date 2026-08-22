import type { Brand, Category } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface CreateCategoryPayload {
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
}

export interface CreateBrandPayload {
  name: string;
  slug?: string;
  description?: string;
  logoUrl?: string;
}

export const catalogApi = {
  listCategories: (): Promise<Category[]> => apiFetch<Category[]>('/categories'),
  createCategory: (payload: CreateCategoryPayload): Promise<Category> =>
    apiFetch<Category>('/categories', { method: 'POST', body: payload, auth: true }),

  listBrands: (): Promise<Brand[]> => apiFetch<Brand[]>('/brands'),
  createBrand: (payload: CreateBrandPayload): Promise<Brand> =>
    apiFetch<Brand>('/brands', { method: 'POST', body: payload, auth: true }),
};
