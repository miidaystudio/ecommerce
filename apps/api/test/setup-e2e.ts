import * as dotenv from 'dotenv';
import * as path from 'path';

// The e2e suites write to whatever database DATABASE_URL names and reach real
// third-party APIs if real keys are present. A developer's apps/api/.env can
// hold production values, so the suites pin everything here, before any Nest
// module or Prisma client reads process.env.

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseHost = (() => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return '';
  }
})();

if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost) && process.env.E2E_ALLOW_REMOTE_DB !== '1') {
  throw new Error(
    `Refusing to run e2e tests against a non-local database (host: "${databaseHost || 'unset'}"). ` +
      'Point DATABASE_URL at the local Postgres (see SETUP.md), or set E2E_ALLOW_REMOTE_DB=1 deliberately.',
  );
}

process.env.NODE_ENV = 'test';

// One pooled connection, as on a transaction pooler with `connection_limit=1`.
// A query that escapes its interactive transaction then deadlocks and fails
// here, instead of only in production.
const pooled = new URL(databaseUrl);
pooled.searchParams.set('connection_limit', '1');
process.env.DATABASE_URL = pooled.toString();

// Placeholders the suites are written against; also guarantees no real payment,
// image or email API is called from a test run.
process.env.RAZORPAY_KEY_ID = 'rzp_test_placeholder';
process.env.RAZORPAY_KEY_SECRET = 'placeholder_test_key_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'placeholder_test_webhook_secret';
process.env.RESEND_API_KEY = 're_placeholder_e2e';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';

// Rate limiting is a global guard; limits are raised (not disabled) so the guard
// still runs. throttling.e2e-spec.ts narrows them per test — the tier resolvers
// read process.env at request time.
process.env.THROTTLE_DEFAULT_LIMIT = process.env.THROTTLE_DEFAULT_LIMIT ?? '100000';
process.env.THROTTLE_AUTH_LIMIT = process.env.THROTTLE_AUTH_LIMIT ?? '100000';
process.env.THROTTLE_SENSITIVE_LIMIT = process.env.THROTTLE_SENSITIVE_LIMIT ?? '100000';
process.env.THROTTLE_OTP_VERIFY_LIMIT = process.env.THROTTLE_OTP_VERIFY_LIMIT ?? '100000';
process.env.THROTTLE_OTP_RESEND_LIMIT = process.env.THROTTLE_OTP_RESEND_LIMIT ?? '100000';
