import jwtConfig from './jwt.config';

describe('jwt config: refresh cookie SameSite', () => {
  const original = { NODE_ENV: process.env.NODE_ENV, SAMESITE: process.env.REFRESH_COOKIE_SAMESITE };

  afterEach(() => {
    process.env.NODE_ENV = original.NODE_ENV;
    if (original.SAMESITE === undefined) delete process.env.REFRESH_COOKIE_SAMESITE;
    else process.env.REFRESH_COOKIE_SAMESITE = original.SAMESITE;
  });

  it('defaults to none in production, where the API and frontends are different sites', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REFRESH_COOKIE_SAMESITE;
    expect(jwtConfig().refreshCookieSameSite).toBe('none');
  });

  it('defaults to lax outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.REFRESH_COOKIE_SAMESITE;
    expect(jwtConfig().refreshCookieSameSite).toBe('lax');
  });

  it('honours an explicit value, case-insensitively', () => {
    process.env.NODE_ENV = 'production';
    process.env.REFRESH_COOKIE_SAMESITE = 'LAX';
    expect(jwtConfig().refreshCookieSameSite).toBe('lax');
  });

  it('falls back to the environment default for an unrecognised value', () => {
    process.env.NODE_ENV = 'development';
    process.env.REFRESH_COOKIE_SAMESITE = 'sideways';
    expect(jwtConfig().refreshCookieSameSite).toBe('lax');
  });
});
