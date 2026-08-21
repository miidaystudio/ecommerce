import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET as string,
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'refresh_token',
  cookieSecure: (process.env.NODE_ENV ?? 'development') === 'production',
}));
