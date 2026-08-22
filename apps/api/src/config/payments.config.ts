import { registerAs } from '@nestjs/config';

export default registerAs('payments', () => ({
  razorpayKeyId: process.env.RAZORPAY_KEY_ID as string,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET as string,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET as string,
  currency: process.env.PAYMENTS_CURRENCY ?? 'INR',
  // Business-rule placeholder (matches the storefront design reference's
  // "Free shipping on orders over ₹999" banner) — make this configurable
  // per-store once Phase 7 settings/shipping config exists.
  freeShippingThreshold: Number(process.env.FREE_SHIPPING_THRESHOLD ?? 999),
  flatShippingFee: Number(process.env.FLAT_SHIPPING_FEE ?? 79),
}));
