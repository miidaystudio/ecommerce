import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ProductReviewSummary, ProductSummary } from '@ecommerce/shared-types';
import { productsApi } from '../../../../lib/api/products.api';
import { reviewsApi } from '../../../../lib/api/reviews.api';
import { settingsApi } from '../../../../lib/api/settings.api';
import { ApiError } from '../../../../lib/api/client';
import { resolveImageUrl } from '../../../../lib/utils/image-url';
import { ProductDetailView } from '../../../../components/product/ProductDetailView';
import { ProductJsonLd } from '../../../../components/product/ProductJsonLd';
import { ProductRow } from '../../../../components/product/ProductRow';
import { RecentlyViewed } from '../../../../components/product/RecentlyViewed';
import { ProductReviews } from '../../../../components/reviews/ProductReviews';

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const product = await productsApi.getBySlug(slug);
    const title = product.seoTitle ?? product.name;
    const description = product.seoDescription ?? product.description.slice(0, 160);
    const image = product.images[0];

    return {
      title,
      description,
      alternates: { canonical: `/products/${product.slug}` },
      openGraph: {
        type: 'website',
        title,
        description,
        url: `/products/${product.slug}`,
        images: image ? [{ url: resolveImageUrl(image.url), alt: image.altText ?? product.name }] : undefined,
      },
    };
  } catch {
    // A missing product still renders a 404 below; metadata must not throw.
    return { title: 'Product not found' };
  }
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;

  let product;
  try {
    product = await productsApi.getBySlug(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-sm text-danger">
          {error instanceof ApiError ? error.message : 'Unable to load this product right now.'}
        </p>
      </div>
    );
  }

  // Supporting data must never take the product page down with it, so each
  // falls back to an empty/neutral value.
  const [related, summary, currency] = await Promise.all([
    productsApi.related(slug).catch((): ProductSummary[] => []),
    reviewsApi.summary(product.id).catch((): ProductReviewSummary | null => null),
    settingsApi
      .getPublic()
      .then((settings) => settings.currency)
      .catch(() => 'INR'),
  ]);

  return (
    <>
      <ProductJsonLd product={product} summary={summary} currency={currency} />
      <ProductDetailView product={product} />
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-16">
        <ProductReviews productId={product.id} productSlug={product.slug} />
        <ProductRow eyebrow="You may also like" heading="Related products" products={related} />
        <RecentlyViewed currentProductId={product.id} />
      </div>
    </>
  );
}
