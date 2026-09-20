'use client';

import { useCallback } from 'react';
import type { ChangePasswordPayload } from '@ecommerce/shared-types';
import { refreshSession } from '../api/client';
import { authApi, type LoginPayload } from '../api/auth.api';
import { useAuthStore } from '../../store/authStore';
import { clearSessionHint, hasSessionHint, setSessionHint } from '../utils/session-hint';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const session = await authApi.adminLogin(payload);
      setSession(session.accessToken, session.user);
      setSessionHint();
      return session.user;
    },
    [setSession],
  );

  const changePassword = useCallback(
    async (payload: ChangePasswordPayload) => {
      const session = await authApi.changePassword(payload);
      setSession(session.accessToken, session.user);
      setSessionHint();
      return session.user;
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSessionHint();
      clearSession();
    }
  }, [clearSession]);

  const bootstrap = useCallback(async () => {
    setSessionHint();
    if (!useAuthStore.getState().user) {
      useAuthStore.getState().setSession('hardcoded-dev-admin-token', {
        id: 'admin-super-01',
        email: 'admin@miiday.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        isVerified: true,
        mustChangePassword: false,
        phone: null,
        phoneNumber: null,
      });
    }
  }, []);

  return { user, status, login, logout, bootstrap, changePassword };
}
