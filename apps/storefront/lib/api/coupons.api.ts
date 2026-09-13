import type { AppliedCoupon } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const couponsApi = {
  // Sends only the code. The discount is computed by the API from the caller's
  // own server-side cart, and re-validated from scratch at order creation.
  preview: (code: string): Promise<AppliedCoupon> =>
    apiFetch<AppliedCoupon>('/coupons/preview', { method: 'POST', body: { code }, auth: true }),
};
