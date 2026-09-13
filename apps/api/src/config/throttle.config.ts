import { registerAs } from '@nestjs/config';

/**
 * Rate-limit tiers.
 *
 * Only one throttler ('default') is registered, and tiered routes override its
 * limit for themselves via `@Throttle()`. Registering several *named*
 * throttlers would apply every one of them to every route, so the strictest
 * would end up governing the whole API.
 *
 * The overrides are passed as functions, not numbers: `@Throttle()` is a
 * decorator, evaluated when the controller class is defined — which happens
 * before `ConfigModule.forRoot()` has loaded `.env` into `process.env`. A bare
 * number would therefore silently freeze at the fallback and ignore a
 * configured value. `Resolvable<number>` lets the throttler call these at
 * request time, once the environment is actually populated.
 */
function num(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Public catalog reads and authenticated browsing. Normal use never sees it. */
export const defaultTtl = (): number => num('THROTTLE_DEFAULT_TTL_MS', 60_000);
export const defaultLimit = (): number => num('THROTTLE_DEFAULT_LIMIT', 120);

/**
 * Credential and token endpoints. A person signing in needs a handful of
 * attempts a minute; a password or refresh-token guesser needs thousands.
 */
export const authTtl = (): number => num('THROTTLE_AUTH_TTL_MS', 60_000);
export const authLimit = (): number => num('THROTTLE_AUTH_LIMIT', 8);

/**
 * Guessable business values (coupon codes) and write endpoints where the
 * volume is itself the abuse (review spam, order spam). Generous for real use,
 * useless for enumeration.
 */
export const sensitiveTtl = (): number => num('THROTTLE_SENSITIVE_TTL_MS', 60_000);
export const sensitiveLimit = (): number => num('THROTTLE_SENSITIVE_LIMIT', 20);

/**
 * OTP verification endpoint. Prevents online brute-force guessing of the 4-digit code
 * on top of the DB attempt lock.
 */
export const otpVerifyTtl = (): number => num('THROTTLE_OTP_VERIFY_TTL_MS', 60_000);
export const otpVerifyLimit = (): number => num('THROTTLE_OTP_VERIFY_LIMIT', 5);

/**
 * OTP resend endpoint. Prevents flooding victim inboxes with OTP emails.
 */
export const otpResendTtl = (): number => num('THROTTLE_OTP_RESEND_TTL_MS', 60_000);
export const otpResendLimit = (): number => num('THROTTLE_OTP_RESEND_LIMIT', 3);

/** Ready-made `@Throttle()` arguments so routes never restate the numbers. */
export const AUTH_THROTTLE = { default: { limit: authLimit, ttl: authTtl } };
export const SENSITIVE_THROTTLE = { default: { limit: sensitiveLimit, ttl: sensitiveTtl } };
export const OTP_VERIFY_THROTTLE = { default: { limit: otpVerifyLimit, ttl: otpVerifyTtl } };
export const OTP_RESEND_THROTTLE = { default: { limit: otpResendLimit, ttl: otpResendTtl } };

export default registerAs('throttle', () => ({
  defaultTtl: defaultTtl(),
  defaultLimit: defaultLimit(),
  authTtl: authTtl(),
  authLimit: authLimit(),
  sensitiveTtl: sensitiveTtl(),
  sensitiveLimit: sensitiveLimit(),
  otpVerifyTtl: otpVerifyTtl(),
  otpVerifyLimit: otpVerifyLimit(),
  otpResendTtl: otpResendTtl(),
  otpResendLimit: otpResendLimit(),
}));
