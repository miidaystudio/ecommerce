import type { BannerView } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const bannersApi = {
  // Public route — returns only active banners, already ordered by position.
  listActive: (): Promise<BannerView[]> => apiFetch<BannerView[]>('/banners'),
};
