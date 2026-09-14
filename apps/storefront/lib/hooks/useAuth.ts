'use client';

import { useCallback } from 'react';
import type { ResendOtpPayload, ResendOtpResponse, VerifyOtpPayload } from '@ecommerce/shared-types';
import { refreshSession } from '../api/client';
import { authApi, type LoginPayload, type RegisterPayload } from '../api/auth.api';
import { useAuthStore } from '../../store/authStore';
import { clearSessionHint, hasSessionHint, setSessionHint } from '../utils/session-hint';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const session = await authApi.login(payload);
      setSession(session.accessToken, session.user);
      setSessionHint();
    },
    [setSession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      return authApi.register(payload);
    },
    [],
  );

  const verifyOtp = useCallback(
    async (payload: VerifyOtpPayload) => {
      const session = await authApi.verifyOtp(payload);
      setSession(session.accessToken, session.user);
      setSessionHint();
      return session;
    },
    [setSession],
  );

  const resendOtp = useCallback(
    async (payload: ResendOtpPayload): Promise<ResendOtpResponse> => {
      return authApi.resendOtp(payload);
    },
    [],
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
    // No hint means this browser never signed in (or signed out), so there is
    // no refresh cookie to try — resolve straight to logged-out instead of
    // making a request that can only 401. See lib/utils/session-hint.ts.
    if (!hasSessionHint()) {
      clearSession();
      return;
    }
    try {
      // Resolves to null when the session is gone; refreshSession has then
      // already cleared the hint and the store.
      await refreshSession();
    } catch {
      // A 429, a server error or a dropped connection says nothing about the
      // session, so the hint is kept and the next load (or a retry) restores it —
      // treating those as logged-out would sign real users out on a blip.
      clearSession();
    }
  }, [clearSession]);

  return { user, status, login, register, verifyOtp, resendOtp, logout, bootstrap };
}
