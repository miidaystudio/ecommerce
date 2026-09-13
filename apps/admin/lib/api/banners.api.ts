import type { BannerView } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface BannerPayload {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  linkUrl?: string;
  position?: number;
  isActive?: boolean;
}

export const bannersApi = {
  list: (): Promise<BannerView[]> => apiFetch<BannerView[]>('/admin/banners', { auth: true }),

  create: (payload: BannerPayload): Promise<BannerView> =>
    apiFetch<BannerView>('/admin/banners', { method: 'POST', body: payload, auth: true }),

  update: (id: string, payload: Partial<BannerPayload>): Promise<BannerView> =>
    apiFetch<BannerView>(`/admin/banners/${id}`, { method: 'PATCH', body: payload, auth: true }),

  remove: (id: string): Promise<{ success: true }> =>
    apiFetch<{ success: true }>(`/admin/banners/${id}`, { method: 'DELETE', auth: true }),
};
