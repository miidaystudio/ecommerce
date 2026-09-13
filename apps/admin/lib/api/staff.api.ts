import type { StaffRole, StaffView } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface CreateStaffPayload {
  email: string;
  password: string;
  role: StaffRole;
  firstName?: string;
  lastName?: string;
}

export interface UpdateStaffPayload {
  role?: StaffRole;
  isBlocked?: boolean;
  firstName?: string;
  lastName?: string;
}

export const staffApi = {
  list: (): Promise<StaffView[]> => apiFetch<StaffView[]>('/admin/staff', { auth: true }),

  create: (payload: CreateStaffPayload): Promise<StaffView> =>
    apiFetch<StaffView>('/admin/staff', { method: 'POST', body: payload, auth: true }),

  update: (id: string, payload: UpdateStaffPayload): Promise<StaffView> =>
    apiFetch<StaffView>(`/admin/staff/${id}`, { method: 'PATCH', body: payload, auth: true }),

  remove: (id: string): Promise<{ success: true }> =>
    apiFetch<{ success: true }>(`/admin/staff/${id}`, { method: 'DELETE', auth: true }),
};
