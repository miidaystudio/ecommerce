import { z } from 'zod';

// Mirrors CreateCouponDto on the API. Numeric/date fields stay strings while
// the user types, then transform into the payload shape the API validates
// again server-side — the backend remains the authority on every rule here.

function optionalPositiveNumber(label: string) {
  return z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) > 0), `${label} must be greater than 0`)
    .transform((v) => (v === '' ? undefined : Number(v)));
}

function optionalNonNegativeNumber(label: string) {
  return z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), `${label} must be 0 or more`)
    .transform((v) => (v === '' ? undefined : Number(v)));
}

function optionalPositiveInt(label: string) {
  return z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .refine((v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 1), `${label} must be a whole number of 1 or more`)
    .transform((v) => (v === '' ? undefined : Number(v)));
}

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ?? '').trim())
  .refine((v) => v === '' || !Number.isNaN(new Date(v).getTime()), 'Enter a valid date')
  .transform((v) => (v === '' ? undefined : new Date(v).toISOString()));

export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'Code is required')
      .regex(/^[A-Z0-9_-]{3,32}$/, 'Use 3–32 uppercase letters, digits, hyphen or underscore'),
    description: z
      .string()
      .trim()
      .max(280, 'Keep the description under 280 characters')
      .optional()
      .transform((v) => (v ? v : undefined)),
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z
      .string()
      .trim()
      .min(1, 'Discount value is required')
      .refine((v) => !Number.isNaN(Number(v)), 'Discount value must be a number')
      .refine((v) => Number(v) > 0, 'Discount value must be greater than 0')
      .transform((v) => Number(v)),
    maxDiscount: optionalPositiveNumber('Max discount'),
    minOrderValue: optionalNonNegativeNumber('Minimum order value'),
    usageLimit: optionalPositiveInt('Total usage limit'),
    perUserLimit: optionalPositiveInt('Per-customer limit'),
    isActive: z.boolean(),
    startsAt: optionalDate,
    expiresAt: optionalDate,
  })
  .refine((data) => !(data.discountType === 'PERCENTAGE' && data.discountValue > 100), {
    message: 'A percentage discount cannot exceed 100',
    path: ['discountValue'],
  })
  .refine((data) => !(data.startsAt && data.expiresAt && data.startsAt >= data.expiresAt), {
    message: 'The start date must be before the expiry date',
    path: ['expiresAt'],
  });

export type CouponFormInput = z.input<typeof couponFormSchema>;
export type CouponFormOutput = z.output<typeof couponFormSchema>;

// Mirrors SAFE_URL_PATTERN / IsSafeUrl on the API: a site-relative path or an
// absolute http(s) URL. Banner URLs end up in an href/src on the public
// storefront, so javascript:/data: and protocol-relative URLs are refused.
const SAFE_URL_PATTERN = /^(?:\/(?![/\\])[^\s]*|https?:\/\/[^\s]+)$/;

function optionalSafeUrl() {
  return z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .refine((v) => v === '' || v.length <= 500, 'URL is too long')
    .refine(
      (v) => v === '' || SAFE_URL_PATTERN.test(v),
      'Use a path starting with "/" or a full http(s):// URL',
    )
    .transform((v) => (v === '' ? undefined : v));
}

export const bannerFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, 'Keep the title under 120 characters'),
  subtitle: z
    .string()
    .trim()
    .max(240, 'Keep the subtitle under 240 characters')
    .optional()
    .transform((v) => (v ? v : undefined)),
  imageUrl: optionalSafeUrl(),
  linkUrl: optionalSafeUrl(),
  position: z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .refine((v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0), 'Position must be 0 or more')
    .transform((v) => (v === '' ? 0 : Number(v))),
  isActive: z.boolean(),
});

export type BannerFormInput = z.input<typeof bannerFormSchema>;
export type BannerFormOutput = z.output<typeof bannerFormSchema>;
