import type { AuthUser } from '@ecommerce/shared-types';
import { create } from 'zustand';
import { setAccessTokenProvider } from '../lib/api/client';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: AuthStatus;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
  setStatus: (status: AuthStatus) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'loading',
  setSession: (accessToken, user) => set({ accessToken, user, status: 'authenticated' }),
  clearSession: () => set({ accessToken: null, user: null, status: 'unauthenticated' }),
  setStatus: (status) => set({ status }),
}));

// Access token lives in memory only (rule.md: no auth tokens in localStorage).
setAccessTokenProvider(() => useAuthStore.getState().accessToken);
