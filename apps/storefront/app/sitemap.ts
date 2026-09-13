import type { MetadataRoute } from 'next';
import { productsApi } from '../lib/api/products.api';
import { catalogApi } from '../lib/api/catalog.api';
import { absoluteUrl } from '../lib/utils/site-url';

/**
 * Built per request, not prerendered.
 *
 * With the default static generation this file is produced once at build time.
 * The product fetch below falls back to an empty list on failure, so a build
 * that runs while the API is unreachable bakes in a sitemap with no products
 * at all — and every crawler sees that until the next deploy or revalidation.
 * Sitemap traffic is a handful of crawler requests, so generating it per
 * request is cheap and always reflects the live catalogue.
 */
export const dynamic = 'force-dynamic';

// The API caps page size, so a growing catalogue is walked rather than asked
// for in one unbounded request.
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/products'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/about'), changeFrequency: 'yearly', priority: 0.4 },
    { url: absoluteUrl('/contact'), changeFrequency: 'yearly', priority: 0.4 },
    { url: absoluteUrl('/faq'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/policy/returns'), changeFrequency: 'yearly', priority: 0.3 },
    { url: absoluteUrl('/policy/terms'), changeFrequency: 'yearly', priority: 0.3 },
    { url: absoluteUrl('/policy/privacy'), changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Account, cart and checkout are deliberately absent — they are per-user
  // pages with nothing to index, and robots.ts disallows them.

  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const collected: { slug: string }[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await productsApi.list({ page, pageSize: PAGE_SIZE });
      collected.push(...result.items.map((item) => ({ slug: item.slug })));
      if (page >= result.totalPages) break;
    }
    productRoutes = collected.map((product) => ({
      url: absoluteUrl(`/products/${product.slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch {
    // A sitemap missing products is far better than a 500 at /sitemap.xml,
    // which would cost every URL in it.
    productRoutes = [];
  }

  let categoryRoutes: MetadataRoute.Sitemap = [];
  try {
    const categories = await catalogApi.listCategories();
    categoryRoutes = categories.map((category) => ({
      // Category browsing is served by the listing page's filter.
      url: absoluteUrl(`/products?category=${encodeURIComponent(category.slug)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch {
    categoryRoutes = [];
  }

  return [...staticRoutes, ...productRoutes, ...categoryRoutes];
}
