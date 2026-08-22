import type { WishlistItemView } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const wishlistApi = {
  list: (): Promise<WishlistItemView[]> => apiFetch<WishlistItemView[]>('/wishlist/me', { auth: true }),

  addItem: (productId: string): Promise<WishlistItemView[]> =>
    apiFetch<WishlistItemView[]>('/wishlist/me/items', { method: 'POST', body: { productId }, auth: true }),

  removeItem: (productId: string): Promise<WishlistItemView[]> =>
    apiFetch<WishlistItemView[]>(`/wishlist/me/items/${productId}`, { method: 'DELETE', auth: true }),
};
