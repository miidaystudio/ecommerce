import type {
  AuthUser,
  RegisterResponse,
  ResendOtpPayload,
  ResendOtpResponse,
  SessionResponse,
  VerifyOtpPayload,
} from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface RegisterPayload {
  email: string;
  password: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: (payload: RegisterPayload): Promise<RegisterResponse> =>
    apiFetch<RegisterResponse>('/auth/register', { method: 'POST', body: payload }),

  verifyOtp: (payload: VerifyOtpPayload): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/verify-otp', { method: 'POST', body: payload }),

  resendOtp: (payload: ResendOtpPayload): Promise<ResendOtpResponse> =>
    apiFetch<ResendOtpResponse>('/auth/resend-otp', { method: 'POST', body: payload }),

  login: (payload: LoginPayload): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/login', { method: 'POST', body: payload }),

  refresh: (): Promise<SessionResponse> =>
    apiFetch<SessionResponse>('/auth/refresh', { method: 'POST' }),

  logout: (): Promise<{ success: true }> =>
    apiFetch<{ success: true }>('/auth/logout', { method: 'POST' }),

  me: (): Promise<AuthUser> => apiFetch<AuthUser>('/users/me', { auth: true }),
};
