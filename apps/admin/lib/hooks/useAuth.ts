'use client';

import { useCallback } from 'react';
import type { ChangePasswordPayload } from '@ecommerce/shared-types';
import { ApiError } from '../api/client';
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
    // No hint means this browser never signed in (or signed out), so there is
    // no refresh cookie to try — resolve straight to logged-out instead of
    // making a request that can only 401. See lib/utils/session-hint.ts.
    if (!hasSessionHint()) {
      clearSession();
      return;
    }
    try {
      const session = await authApi.refresh();
      setSession(session.accessToken, session.user);
      setSessionHint();
    } catch (err) {
      // Only a 401 means the session is really gone (expired, revoked, blocked).
      // A 429, a server error or a dropped connection says nothing about the
      // session, so the hint is kept and the next load (or a retry) restores it —
      // treating those as logged-out would sign real users out on a blip.
      if (err instanceof ApiError && err.status === 401) {
        clearSessionHint();
        // Have the API clear the dead httpOnly cookie (scripts can't), and wait
        // for it before reporting logged-out: the admin redirects to /login on
        // that status, and its middleware — which can only decode the cookie, not
        // verify it — would otherwise bounce the browser straight back.
        await authApi.logout().catch(() => undefined);
      }
      clearSession();
    }
  }, [setSession, clearSession]);

  return { user, status, login, logout, bootstrap, changePassword };
}
