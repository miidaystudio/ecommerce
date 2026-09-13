import type { AuthUser, ChangePasswordPayload, SessionResponse } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  adminLogin: (payload: LoginPayload): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/admin/login', { method: 'POST', body: payload }),

  changePassword: (payload: ChangePasswordPayload): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/change-password', { method: 'POST', body: payload, auth: true }),

  refresh: (): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/refresh', { method: 'POST' }),

  logout: (): Promise<{ success: true }> =>
    apiFetch<{ success: true }>('/auth/logout', { method: 'POST' }),

  me: (): Promise<AuthUser> => apiFetch<AuthUser>('/users/me', { auth: true }),
};
