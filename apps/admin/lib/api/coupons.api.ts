import type { CouponView, DiscountType, PaginatedCoupons } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface CouponPayload {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minOrderValue?: number;
  usageLimit?: number;
  perUserLimit?: number;
  isActive?: boolean;
  startsAt?: string;
  expiresAt?: string;
}

export const couponsApi = {
  list: (page = 1, pageSize = 20, q?: string): Promise<PaginatedCoupons> =>
    apiFetch<PaginatedCoupons>(
      `/admin/coupons?page=${page}&pageSize=${pageSize}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      { auth: true },
    ),

  getById: (id: string): Promise<CouponView> => apiFetch<CouponView>(`/admin/coupons/${id}`, { auth: true }),

  create: (payload: CouponPayload): Promise<CouponView> =>
    apiFetch<CouponView>('/admin/coupons', { method: 'POST', body: payload, auth: true }),

  update: (id: string, payload: Partial<CouponPayload>): Promise<CouponView> =>
    apiFetch<CouponView>(`/admin/coupons/${id}`, { method: 'PATCH', body: payload, auth: true }),

  remove: (id: string): Promise<{ success: true }> =>
    apiFetch<{ success: true }>(`/admin/coupons/${id}`, { method: 'DELETE', auth: true }),
};
