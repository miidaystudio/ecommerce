import { z } from 'zod';

// Mirrors UpdateSettingsDto on the API. Numeric fields stay strings while the
// user types, then transform into the payload. The API validates all of this
// again — it is the authority, not this file.

function money(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine((v) => Number(v) >= 0, `${label} cannot be negative`)
    .refine((v) => Number(v) <= max, `${label} is unrealistically large`)
    .transform((v) => Number(v));
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .refine((v) => v.length <= max, `${label} is too long`)
    // Sent as '' rather than dropped, so clearing a field actually clears it
    // instead of the service's `?? current` merge keeping the old value.
    .transform((v) => v);

export const settingsFormSchema = z.object({
  storeName: z.string().trim().min(1, 'Store name is required').max(80, 'Store name is too long'),
  supportEmail: z.string().trim().min(1, 'Support email is required').email('Enter a valid email'),
  supportPhone: optionalText(40, 'Phone'),
  addressLine: optionalText(300, 'Address'),

  freeShippingThreshold: money('Free shipping threshold', 10_000_000),
  flatShippingFee: money('Flat shipping fee', 100_000),
  taxRatePercent: z
    .string()
    .trim()
    .min(1, 'Tax rate is required')
    .refine((v) => !Number.isNaN(Number(v)), 'Tax rate must be a number')
    .refine((v) => Number(v) >= 0 && Number(v) <= 100, 'Tax rate must be between 0 and 100')
    .transform((v) => Number(v)),
  lowStockThreshold: z
    .string()
    .trim()
    .min(1, 'Low stock threshold is required')
    .refine((v) => Number.isInteger(Number(v)), 'Low stock threshold must be a whole number')
    .refine((v) => Number(v) >= 0, 'Low stock threshold cannot be negative')
    .transform((v) => Number(v)),

  ordersEnabled: z.boolean(),
  maintenanceNotice: optionalText(280, 'Message'),
});

export type SettingsFormInput = z.input<typeof settingsFormSchema>;
export type SettingsFormOutput = z.output<typeof settingsFormSchema>;
