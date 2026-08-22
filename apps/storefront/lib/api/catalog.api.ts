import type { Brand, Category } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const catalogApi = {
  listCategories: (): Promise<Category[]> => apiFetch<Category[]>('/categories'),
  listBrands: (): Promise<Brand[]> => apiFetch<Brand[]>('/brands'),
};
