import type { WishlistItemView } from '@ecommerce/shared-types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { wishlistApi } from '../lib/api/wishlist.api';
import { ApiError } from '../lib/api/client';
import { useAuthStore } from './authStore';

interface WishlistProductRef {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
}

interface WishlistImageRef {
  url: string;
  altText: string | null;
}

interface WishlistState {
  items: WishlistItemView[];
  loading: boolean;
  error: string;
  toggle: (product: WishlistProductRef, image: WishlistImageRef | null) => Promise<void>;
  mergeGuestIntoServer: () => Promise<void>;
  resetOnLogout: () => void;
}

function isAuthenticated(): boolean {
  return useAuthStore.getState().status === 'authenticated';
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      loading: false,
      error: '',

      toggle: async (product, image) => {
        const exists = get().items.some((item) => item.productId === product.id);

        if (isAuthenticated()) {
          set({ loading: true, error: '' });
          try {
            const response = exists
              ? await wishlistApi.removeItem(product.id)
              : await wishlistApi.addItem(product.id);
            set({ items: response, loading: false });
          } catch (error) {
            set({ error: errorMessage(error, 'Could not update wishlist.'), loading: false });
          }
          return;
        }

        if (exists) {
          set((state) => ({ items: state.items.filter((item) => item.productId !== product.id) }));
          return;
        }

        const newItem: WishlistItemView = {
          id: product.id,
          productId: product.id,
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            inStock: product.inStock,
            available: true,
          },
          image,
        };
        set((state) => ({ items: [...state.items, newItem] }));
      },

      mergeGuestIntoServer: async () => {
        const { items } = get();

        if (items.length === 0) {
          try {
            const response = await wishlistApi.list();
            set({ items: response, error: '' });
          } catch (error) {
            set({ error: errorMessage(error, 'Could not load your wishlist.') });
          }
          return;
        }

        set({ loading: true });
        let failures = 0;
        // Sequential, mirroring the cart merge — avoids racing concurrent
        // writes against the same server-side wishlist.
        for (const item of items) {
          try {
            await wishlistApi.addItem(item.productId);
          } catch {
            failures += 1;
          }
        }

        try {
          const response = await wishlistApi.list();
          set({
            items: response,
            loading: false,
            error: failures > 0 ? `${failures} item(s) could not be merged into your wishlist.` : '',
          });
        } catch (error) {
          set({ error: errorMessage(error, 'Could not sync your wishlist.'), loading: false });
        }
      },

      resetOnLogout: () => set({ items: [], error: '' }),
    }),
    {
      name: 'miiday-wishlist',
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
