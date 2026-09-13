import { SAFE_URL_PATTERN } from './is-safe-url.decorator';

describe('SAFE_URL_PATTERN', () => {
  const allowed = [
    '/products',
    '/products?category=outerwear&sort=newest',
    '/uploads/products/abc/img.png',
    '/',
    'http://example.com/a',
    'https://cdn.example.com/img.png?v=2',
  ];

  const refused = [
    // Script-executing schemes — the reason this guard exists.
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    // Protocol-relative: browsers resolve these to an external host.
    '//evil.com/x',
    '/\\evil.com/x',
    // Other schemes and bare hosts.
    'file:///etc/passwd',
    'ftp://example.com',
    'example.com/products',
    'products',
    '',
    ' /products',
    '/pro ducts',
  ];

  it.each(allowed)('allows %p', (value) => {
    expect(SAFE_URL_PATTERN.test(value)).toBe(true);
  });

  it.each(refused)('refuses %p', (value) => {
    expect(SAFE_URL_PATTERN.test(value)).toBe(false);
  });
});
