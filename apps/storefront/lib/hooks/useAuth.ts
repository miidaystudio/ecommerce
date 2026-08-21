'use client';

import { useCallback } from 'react';
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth.api';
import { useAuthStore } from '../../store/authStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const session = await authApi.login(payload);
      setSession(session.accessToken, session.user);
    },
    [setSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const session = await authApi.register(payload);
      setSession(session.accessToken, session.user);
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const bootstrap = useCallback(async () => {
    try {
      const session = await authApi.refresh();
      setSession(session.accessToken, session.user);
    } catch {
      clearSession();
    }
  }, [setSession, clearSession]);

  return { user, status, login, register, logout, bootstrap };
}
