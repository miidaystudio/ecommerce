import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.API_PORT ?? process.env.PORT ?? '4000', 10),
  globalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Number of proxy hops in front of the API, or an Express trust-proxy value.
  // Empty (the default) means X-Forwarded-For is not trusted — see main.ts.
  trustProxy: process.env.TRUST_PROXY ?? '',
}));
