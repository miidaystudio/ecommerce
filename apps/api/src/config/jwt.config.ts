import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET as string,
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'refresh_token',
  cookieSecure: (process.env.NODE_ENV ?? 'development') === 'production',
  // The API (Render) and the frontends (Vercel) are different sites, so the
  // refresh cookie is only stored and sent on their credentialed fetches when it
  // is SameSite=None. Lax/Strict are fine only when everything shares one site
  // (e.g. localhost, or custom subdomains of one domain).
  refreshCookieSameSite: parseSameSite(process.env.REFRESH_COOKIE_SAMESITE),
}));

function parseSameSite(value: string | undefined): 'lax' | 'strict' | 'none' {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'lax' || normalized === 'strict' || normalized === 'none') {
    return normalized;
  }
  return (process.env.NODE_ENV ?? 'development') === 'production' ? 'none' : 'lax';
}
