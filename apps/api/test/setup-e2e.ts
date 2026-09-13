// Rate limiting is a global guard, so without this every e2e suite would be
// silently racing the auth tier's 8-requests-per-minute budget and a new test
// that logs in a few extra times would fail with a confusing 429.
//
// The limits are raised here rather than disabled so the guard still runs on
// the real code path. `throttling.e2e-spec.ts` overrides these per-test to
// assert the limits actually bite — it can, because the tier resolvers read
// process.env at request time rather than at import time.
process.env.THROTTLE_DEFAULT_LIMIT = process.env.THROTTLE_DEFAULT_LIMIT ?? '100000';
process.env.THROTTLE_AUTH_LIMIT = process.env.THROTTLE_AUTH_LIMIT ?? '100000';
process.env.THROTTLE_SENSITIVE_LIMIT = process.env.THROTTLE_SENSITIVE_LIMIT ?? '100000';
process.env.THROTTLE_OTP_VERIFY_LIMIT = process.env.THROTTLE_OTP_VERIFY_LIMIT ?? '100000';
process.env.THROTTLE_OTP_RESEND_LIMIT = process.env.THROTTLE_OTP_RESEND_LIMIT ?? '100000';
