'use client';

import { useWishlistStore } from '../../store/wishlistStore';

export function useWishlist() {
  const items = useWishlistStore((s) => s.items);
  const loading = useWishlistStore((s) => s.loading);
  const error = useWishlistStore((s) => s.error);
  const toggle = useWishlistStore((s) => s.toggle);

  function isWishlisted(productId: string): boolean {
    return items.some((item) => item.productId === productId);
  }

  return { items, loading, error, toggle, isWishlisted };
}
