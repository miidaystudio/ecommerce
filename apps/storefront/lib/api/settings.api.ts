import type { PublicStoreSettings } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const settingsApi = {
  // Public route — the storefront-visible subset only (no operational thresholds).
  getPublic: (): Promise<PublicStoreSettings> => apiFetch<PublicStoreSettings>('/settings'),
};
