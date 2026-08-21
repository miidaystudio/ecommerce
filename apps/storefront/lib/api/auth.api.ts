import type { AuthUser, SessionResponse } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: (payload: RegisterPayload): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/register', { method: 'POST', body: payload }),

  login: (payload: LoginPayload): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/login', { method: 'POST', body: payload }),

  refresh: (): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/refresh', { method: 'POST' }),

  logout: (): Promise<{ success: true }> =>
    apiFetch<{ success: true }>('/auth/logout', { method: 'POST' }),

  me: (): Promise<AuthUser> => apiFetch<AuthUser>('/users/me', { auth: true }),
};
