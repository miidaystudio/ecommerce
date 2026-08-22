'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { bootstrap, status } = useAuth();
  const previousStatus = useRef(status);
  const hasMerged = useRef(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Sync guest cart/wishlist into the server once per login, and clear both
  // client stores on an actual logout (not the initial 'loading' -> 'unauthenticated'
  // resolution for a never-logged-in guest, whose local cart must survive).
  useEffect(() => {
    const previous = previousStatus.current;

    if (status === 'authenticated' && !hasMerged.current) {
      hasMerged.current = true;
      void useCartStore.getState().mergeGuestIntoServer();
      void useWishlistStore.getState().mergeGuestIntoServer();
    }

    if (status === 'unauthenticated' && previous === 'authenticated') {
      useCartStore.getState().resetOnLogout();
      useWishlistStore.getState().resetOnLogout();
      hasMerged.current = false;
    }

    previousStatus.current = status;
  }, [status]);

  return <>{children}</>;
}
