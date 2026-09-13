import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/utils/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Per-user and transactional pages: nothing to index, and crawling
        // them wastes budget that should go to product pages.
        disallow: ['/account', '/cart', '/checkout', '/login', '/register'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
