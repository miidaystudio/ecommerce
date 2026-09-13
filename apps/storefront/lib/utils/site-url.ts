// Absolute origin of the storefront. Canonical URLs, Open Graph images, the
// sitemap and robots.txt all need a real origin — a relative value is invalid
// for each of them — so this falls back to localhost for development only.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
