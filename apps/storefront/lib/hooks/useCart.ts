'use client';

import { selectItemCount, selectSubtotal, useCartStore } from '../../store/cartStore';

export function useCart() {
  const items = useCartStore((s) => s.items);
  const loading = useCartStore((s) => s.loading);
  const error = useCartStore((s) => s.error);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  return {
    items,
    loading,
    error,
    itemCount: selectItemCount(items),
    subtotal: selectSubtotal(items),
    addItem,
    updateQuantity,
    removeItem,
    clear,
  };
}
