import type { CartItemView, ProductVariant } from '@ecommerce/shared-types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartApi } from '../lib/api/cart.api';
import { ApiError } from '../lib/api/client';
import { useAuthStore } from './authStore';

interface CartProductRef {
  id: string;
  name: string;
  slug: string;
}

interface CartImageRef {
  url: string;
  altText: string | null;
}

interface CartState {
  items: CartItemView[];
  loading: boolean;
  error: string;
  addItem: (
    variant: ProductVariant,
    product: CartProductRef,
    image: CartImageRef | null,
    quantity: number,
  ) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clear: () => Promise<void>;
  mergeGuestIntoServer: () => Promise<void>;
  resetOnLogout: () => void;
}

function isAuthenticated(): boolean {
  return useAuthStore.getState().status === 'authenticated';
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function selectItemCount(items: CartItemView[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function selectSubtotal(items: CartItemView[]): number {
  return items.reduce((total, item) => total + item.lineTotal, 0);
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      loading: false,
      error: '',

      addItem: async (variant, product, image, quantity) => {
        if (isAuthenticated()) {
          set({ loading: true, error: '' });
          try {
            const response = await cartApi.addItem(variant.id, quantity);
            set({ items: response.items, loading: false });
          } catch (error) {
            set({ error: errorMessage(error, 'Could not add item to cart.'), loading: false });
          }
          return;
        }

        set((state) => {
          const existing = state.items.find((item) => item.variantId === variant.id);

          if (existing) {
            const desired = existing.quantity + quantity;
            const nextQuantity = Math.min(desired, variant.stock);
            const clamped = nextQuantity < desired;
            return {
              items: state.items.map((item) =>
                item.variantId === variant.id
                  ? { ...item, quantity: nextQuantity, lineTotal: item.price * nextQuantity, stock: variant.stock }
                  : item,
              ),
              error: clamped ? `Only ${variant.stock} left in stock` : '',
            };
          }

          const nextQuantity = Math.min(quantity, variant.stock);
          const clamped = nextQuantity < quantity;
          if (nextQuantity <= 0) {
            return { error: `Only ${variant.stock} left in stock` };
          }

          const newItem: CartItemView = {
            id: variant.id,
            variantId: variant.id,
            quantity: nextQuantity,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
            lineTotal: variant.price * nextQuantity,
            stock: variant.stock,
            available: true,
            product,
            variant: { name: variant.name, attributes: variant.attributes },
            image,
          };
          return {
            items: [...state.items, newItem],
            error: clamped ? `Only ${variant.stock} left in stock` : '',
          };
        });
      },

      updateQuantity: async (variantId, quantity) => {
        if (isAuthenticated()) {
          set({ loading: true, error: '' });
          try {
            const response = await cartApi.updateItem(variantId, quantity);
            set({ items: response.items, loading: false });
          } catch (error) {
            set({ error: errorMessage(error, 'Could not update quantity.'), loading: false });
          }
          return;
        }

        set((state) => ({
          items: state.items.map((item) => {
            if (item.variantId !== variantId) return item;
            const nextQuantity = Math.max(1, Math.min(quantity, item.stock));
            return { ...item, quantity: nextQuantity, lineTotal: item.price * nextQuantity };
          }),
        }));
      },

      removeItem: async (variantId) => {
        if (isAuthenticated()) {
          set({ loading: true, error: '' });
          try {
            const response = await cartApi.removeItem(variantId);
            set({ items: response.items, loading: false });
          } catch (error) {
            set({ error: errorMessage(error, 'Could not remove item.'), loading: false });
          }
          return;
        }

        set((state) => ({ items: state.items.filter((item) => item.variantId !== variantId) }));
      },

      clear: async () => {
        if (isAuthenticated()) {
          set({ loading: true, error: '' });
          try {
            await cartApi.clear();
            set({ items: [], loading: false });
          } catch (error) {
            set({ error: errorMessage(error, 'Could not clear cart.'), loading: false });
          }
          return;
        }

        set({ items: [] });
      },

      mergeGuestIntoServer: async () => {
        const { items } = get();

        if (items.length === 0) {
          try {
            const response = await cartApi.get();
            set({ items: response.items, error: '' });
          } catch (error) {
            set({ error: errorMessage(error, 'Could not load your cart.') });
          }
          return;
        }

        set({ loading: true });
        let failures = 0;
        // Sequential on purpose: concurrent addItem calls for the same server
        // cart can race each other's read-modify-write and drop quantity.
        for (const item of items) {
          try {
            await cartApi.addItem(item.variantId, item.quantity);
          } catch {
            failures += 1;
          }
        }

        try {
          const response = await cartApi.get();
          set({
            items: response.items,
            loading: false,
            error: failures > 0 ? `${failures} item(s) could not be merged into your cart.` : '',
          });
        } catch (error) {
          set({ error: errorMessage(error, 'Could not sync your cart.'), loading: false });
        }
      },

      resetOnLogout: () => set({ items: [], error: '' }),
    }),
    {
      name: 'miiday-cart',
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
