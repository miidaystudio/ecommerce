import type { UserAddress } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface AddressPayload {
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

export const addressesApi = {
  list: (): Promise<UserAddress[]> => apiFetch<UserAddress[]>('/users/me/addresses', { auth: true }),

  create: (payload: AddressPayload): Promise<UserAddress> =>
    apiFetch<UserAddress>('/users/me/addresses', { method: 'POST', body: payload, auth: true }),

  update: (id: string, payload: Partial<AddressPayload>): Promise<UserAddress> =>
    apiFetch<UserAddress>(`/users/me/addresses/${id}`, { method: 'PATCH', body: payload, auth: true }),

  setDefault: (id: string): Promise<UserAddress> =>
    apiFetch<UserAddress>(`/users/me/addresses/${id}/default`, { method: 'PATCH', auth: true }),

  remove: (id: string): Promise<{ success: true }> =>
    apiFetch<{ success: true }>(`/users/me/addresses/${id}`, { method: 'DELETE', auth: true }),
};
