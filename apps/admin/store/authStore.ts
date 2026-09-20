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

const HARDCODED_ADMIN_USER: AuthUser = {
  id: 'admin-super-01',
  email: 'admin@miiday.com',
  firstName: 'Super',
  lastName: 'Admin',
  role: 'SUPER_ADMIN',
  isVerified: true,
  mustChangePassword: false,
  phone: null,
  phoneNumber: null,
};

export const useAuthStore = create<AuthState>((set) => ({
  user: HARDCODED_ADMIN_USER,
  accessToken: 'hardcoded-dev-admin-token',
  status: 'authenticated',
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
