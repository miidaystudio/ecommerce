import type { Brand, Category } from '@ecommerce/shared-types';
import { apiFetch } from './client';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-summer', name: 'SUMMER 2026', slug: 'summer-2026', description: 'Summer apparel', imageUrl: null, parentId: null },
  { id: 'cat-headwear', name: 'HEADWEAR', slug: 'headwear', description: 'Caps and beanies', imageUrl: null, parentId: null },
  { id: 'cat-outerwear', name: 'OUTERWEAR', slug: 'outerwear', description: 'Jackets, parkas and coats', imageUrl: null, parentId: null },
  { id: 'cat-essentials', name: 'ESSENTIALS', slug: 'essentials', description: 'Core everyday wardrobe', imageUrl: null, parentId: null },
];

const DEFAULT_BRANDS: Brand[] = [
  { id: 'br-miiday', name: 'MIIDAY STUDIO', slug: 'miiday-studio', description: 'Engineering Atelier', logoUrl: null },
  { id: 'br-puremoda', name: 'PUREMODA', slug: 'puremoda', description: 'High fashion collection', logoUrl: null },
];

export const catalogApi = {
  listCategories: async (): Promise<Category[]> => {
    try {
      const res = await apiFetch<Category[]>('/categories');
      return res && res.length > 0 ? res : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  },
  listBrands: async (): Promise<Brand[]> => {
    try {
      const res = await apiFetch<Brand[]>('/brands');
      return res && res.length > 0 ? res : DEFAULT_BRANDS;
    } catch {
      return DEFAULT_BRANDS;
    }
  },
};
