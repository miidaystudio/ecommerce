import type { AuthUser, SessionResponse } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  adminLogin: (payload: LoginPayload): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/admin/login', { method: 'POST', body: payload }),

  refresh: (): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/refresh', { method: 'POST' }),

  logout: (): Promise<{ success: true }> =>
    apiFetch<{ success: true }>('/auth/logout', { method: 'POST' }),

  me: (): Promise<AuthUser> => apiFetch<AuthUser>('/users/me', { auth: true }),
};
