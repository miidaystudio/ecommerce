import type { CartResponse, PriceQuote } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const cartApi = {
  get: (): Promise<CartResponse> => apiFetch<CartResponse>('/cart/me', { auth: true }),

  addItem: (variantId: string, quantity: number): Promise<CartResponse> =>
    apiFetch<CartResponse>('/cart/me/items', { method: 'POST', body: { variantId, quantity }, auth: true }),

  updateItem: (variantId: string, quantity: number): Promise<CartResponse> =>
    apiFetch<CartResponse>(`/cart/me/items/${variantId}`, { method: 'PATCH', body: { quantity }, auth: true }),

  removeItem: (variantId: string): Promise<CartResponse> =>
    apiFetch<CartResponse>(`/cart/me/items/${variantId}`, { method: 'DELETE', auth: true }),

  // Public, so it works for a guest's browser-only cart too. Only variant ids and
  // quantities are sent; the API prices them from live data.
  quote: (items: { variantId: string; quantity: number }[]): Promise<PriceQuote> =>
    apiFetch<PriceQuote>('/cart/quote', { method: 'POST', body: { items } }),

  clear: (): Promise<{ success: true }> =>
    apiFetch<{ success: true }>('/cart/me', { method: 'DELETE', auth: true }),
};
