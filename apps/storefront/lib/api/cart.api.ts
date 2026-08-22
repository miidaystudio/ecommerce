import type { CartResponse } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const cartApi = {
  get: (): Promise<CartResponse> => apiFetch<CartResponse>('/cart/me', { auth: true }),

  addItem: (variantId: string, quantity: number): Promise<CartResponse> =>
    apiFetch<CartResponse>('/cart/me/items', { method: 'POST', body: { variantId, quantity }, auth: true }),

  updateItem: (variantId: string, quantity: number): Promise<CartResponse> =>
    apiFetch<CartResponse>(`/cart/me/items/${variantId}`, { method: 'PATCH', body: { quantity }, auth: true }),

  removeItem: (variantId: string): Promise<CartResponse> =>
    apiFetch<CartResponse>(`/cart/me/items/${variantId}`, { method: 'DELETE', auth: true }),

  clear: (): Promise<{ success: true }> =>
    apiFetch<{ success: true }>('/cart/me', { method: 'DELETE', auth: true }),
};
