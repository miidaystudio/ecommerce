import type { AuthUser } from '@ecommerce/shared-types';
import { create } from 'zustand';
import { scheduleSessionRefresh, setAccessTokenProvider, setSessionHandlers } from '../lib/api/client';
import { clearSessionHint, setSessionHint } from '../lib/utils/session-hint';

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
  setSession: (accessToken, user) => {
    scheduleSessionRefresh(accessToken);
    set({ accessToken, user, status: 'authenticated' });
  },
  clearSession: () => {
    scheduleSessionRefresh(null);
    set({ accessToken: null, user: null, status: 'unauthenticated' });
  },
  setStatus: (status) => set({ status }),
}));

// Access token lives in memory only (rule.md: no auth tokens in localStorage).
setAccessTokenProvider(() => useAuthStore.getState().accessToken);

setSessionHandlers({
  onRefreshed: (session) => {
    useAuthStore.getState().setSession(session.accessToken, session.user);
    setSessionHint();
  },
  onExpired: () => {
    clearSessionHint();
    useAuthStore.getState().clearSession();
  },
});
