import type { StoreSettingsView } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface SettingsPayload {
  storeName?: string;
  supportEmail?: string;
  supportPhone?: string;
  addressLine?: string;
  currency?: string;
  freeShippingThreshold?: number;
  flatShippingFee?: number;
  taxRatePercent?: number;
  lowStockThreshold?: number;
  ordersEnabled?: boolean;
  maintenanceNotice?: string;
}

export const settingsApi = {
  get: (): Promise<StoreSettingsView> => apiFetch<StoreSettingsView>('/admin/settings', { auth: true }),

  update: (payload: SettingsPayload): Promise<StoreSettingsView> =>
    apiFetch<StoreSettingsView>('/admin/settings', { method: 'PATCH', body: payload, auth: true }),
};
