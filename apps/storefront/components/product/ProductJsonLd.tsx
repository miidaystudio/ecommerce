import type { ProductDetail, ProductReviewSummary } from '@ecommerce/shared-types';
import { absoluteUrl } from '../../lib/utils/site-url';
import { resolveImageUrl } from '../../lib/utils/image-url';

/**
 * schema.org Product markup, so search results can show price, availability
 * and star ratings for a product page.
 *
 * The values come from the same API responses the page renders, rather than
 * being restated here — structured data that disagrees with the visible page
 * is treated as spam by search engines, and would be wrong anyway.
 */
export function ProductJsonLd({
  product,
  summary,
  currency,
}: {
  product: ProductDetail;
  summary: ProductReviewSummary | null;
  currency: string;
}) {
  const inStock = product.variants.some((variant) => variant.stock > 0);
  const prices = product.variants.map((variant) => variant.price);
  const lowPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const highPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const url = absoluteUrl(`/products/${product.slug}`);

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.seoDescription ?? product.description,
    url,
    image: product.images.map((image) => resolveImageUrl(image.url)),
    category: product.category.name,
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand.name } } : {}),
    ...(product.variants.length === 1
      ? { sku: product.variants[0].sku }
      : { sku: product.variants[0]?.sku }),
  };

  // A single variant gets a plain Offer; several get an AggregateOffer with the
  // real price band rather than a single price that is true for only one.
  jsonLd.offers =
    product.variants.length > 1
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: currency,
          lowPrice,
          highPrice,
          offerCount: product.variants.length,
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url,
        }
      : {
          '@type': 'Offer',
          priceCurrency: currency,
          price: lowPrice,
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url,
        };

  // Only emitted when real approved reviews exist — a zero-count rating is
  // invalid markup, not a neutral one.
  if (summary && summary.ratingCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: summary.ratingAverage,
      reviewCount: summary.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return (
    <script
      type="application/ld+json"
      // Values are store-controlled product data, and JSON.stringify escapes
      // the quotes/backslashes that would otherwise break out of the script.
      // "</" is escaped because it would close the tag early.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
      }}
    />
  );
}
