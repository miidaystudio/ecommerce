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
  createCategory: async (payload: CreateCategoryPayload): Promise<Category> => {
    try {
      return await apiFetch<Category>('/categories', { method: 'POST', body: payload, auth: true });
    } catch {
      const newCat: Category = {
        id: `cat-${Date.now()}`,
        name: payload.name,
        slug: payload.slug || payload.name.toLowerCase().replace(/\s+/g, '-'),
        description: payload.description || null,
        imageUrl: payload.imageUrl || null,
        parentId: payload.parentId || null,
      };
      DEFAULT_CATEGORIES.push(newCat);
      return newCat;
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
  createBrand: async (payload: CreateBrandPayload): Promise<Brand> => {
    try {
      return await apiFetch<Brand>('/brands', { method: 'POST', body: payload, auth: true });
    } catch {
      const newBrand: Brand = {
        id: `br-${Date.now()}`,
        name: payload.name,
        slug: payload.slug || payload.name.toLowerCase().replace(/\s+/g, '-'),
        description: payload.description || null,
        logoUrl: payload.logoUrl || null,
      };
      DEFAULT_BRANDS.push(newBrand);
      return newBrand;
    }
  },
};

