import Link from 'next/link';
import type { BannerView } from '@ecommerce/shared-types';
import { bannersApi } from '../lib/api/banners.api';
import { productsApi } from '../lib/api/products.api';
import { ApiError } from '../lib/api/client';
import { HomeBanners } from '../components/layout/HomeBanners';
import { ProductCard } from '../components/product/ProductCard';
import { RecentlyViewedStrip } from '../components/product/RecentlyViewed';

export const revalidate = 60;

const CATEGORIES = [
  { name: 'Home & Living', slug: 'home', count: '14 items', bg: 'bg-[#EAE4D9]', icon: '🛋️' },
  { name: 'Fashion & Linen', slug: 'fashion', count: '22 items', bg: 'bg-[#E3DDD1]', icon: '👔' },
  { name: 'Beauty & Skincare', slug: 'beauty', count: '18 items', bg: 'bg-[#E8E1D5]', icon: '🌿' },
  { name: 'Kitchen & Tableware', slug: 'kitchen', count: '30 items', bg: 'bg-[#DFD8CC]', icon: '🏺' },
  { name: 'Kids & Nursery', slug: 'kids', count: '12 items', bg: 'bg-[#E5DFD3]', icon: '🧸' },
  { name: 'Bath & Wellness', slug: 'wellness', count: '16 items', bg: 'bg-[#ECE6DC]', icon: '🕯️' },
];

export default async function HomePage() {
  let featured: Awaited<ReturnType<typeof productsApi.list>> | null = null;
  let error = '';

  try {
    featured = await productsApi.list({ sort: 'newest', pageSize: 8 });
  } catch (err) {
    error = err instanceof ApiError
      ? err.message
      : 'Unable to load featured products right now.';
  }

  // Banners are merchandising, not the page — a failed fetch just hides them.
  let banners: BannerView[] = [];

  try {
    banners = await bannersApi.listActive();
  } catch {
    banners = [];
  }

  return (
    <div className="flex flex-col gap-16 pb-20">
      {/* Hero Section */}
      <section className="border-b border-border bg-surface/50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center rounded-full border border-muted-border/40 bg-background px-3.5 py-1 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              New season · linen &amp; oak
            </span>

            <h1 className="text-[40px] font-semibold leading-[1.1] tracking-[-0.03em] text-text-primary sm:text-hero">
              Everything for
              <br />
              a slower home<span className="text-accent">.</span>
            </h1>

            <p className="max-w-md text-base leading-relaxed text-text-secondary">
              A single-vendor marketplace across home, kitchen, beauty, and kids.
              Curated by one team. Shipped from one warehouse.
            </p>

            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex h-12 items-center justify-center rounded bg-primary px-7 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
              >
                Shop new arrivals
              </Link>

              <Link
                href="/products"
                className="inline-flex h-12 items-center justify-center rounded border border-border bg-background px-7 text-sm font-medium text-text-primary transition hover:bg-surface"
              >
                Browse categories
              </Link>
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-surface shadow-card lg:aspect-[7/6]">
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#FAF9F6] to-[#EFEBE1] p-8 text-center">
              <span className="text-4xl">🏺</span>

              <p className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
                Handcrafted Essentials · 2026 Collection
              </p>

              <h2 className="text-xl font-medium text-text-primary">
                Organic ceramics, raw linen &amp; solid oak
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic merchandising banners */}
      <HomeBanners banners={banners} />

      {/* Shop by Category Section */}
      <section className="mx-auto w-full max-w-6xl px-6">
        <div className="mb-8 flex items-baseline justify-between">
          <div>
            <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Collections
            </span>

            <h2 className="mt-1 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              Shop by category
            </h2>
          </div>

          <Link
            href="/products"
            className="text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/products?category=${cat.slug}`}
              className="group flex flex-col items-center gap-3 rounded-lg border border-border bg-background p-4 text-center transition hover:border-primary hover:shadow-card"
            >
              <div
                className={`flex aspect-square w-full items-center justify-center rounded-lg ${cat.bg} text-3xl transition duration-300 group-hover:scale-105`}
              >
                {cat.icon}
              </div>

              <div>
                <h3 className="text-sm font-medium text-text-primary">
                  {cat.name}
                </h3>
                <span className="text-2xs text-text-secondary">
                  {cat.count}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Loved This Month / Featured Products */}
      <section className="mx-auto w-full max-w-6xl px-6">
        <div className="mb-8 flex items-baseline justify-between">
          <div>
            <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Curated selections
            </span>

            <h2 className="mt-1 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              Loved this month
            </h2>
          </div>

          <Link
            href="/products"
            className="text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            See all products →
          </Link>
        </div>

        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : featured && featured.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {featured.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-12 text-center">
            <p className="text-sm text-text-secondary">
              No products available in the catalog yet.
            </p>
          </div>
        )}
      </section>

      {/* Recently Viewed */}
      <div className="mx-auto w-full max-w-6xl px-6">
        <RecentlyViewedStrip />
      </div>

      {/* Brand Value Propositions */}
      <section className="border-t border-border bg-surface/40 py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 md:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-background p-6">
            <span className="font-mono text-2xs font-semibold uppercase tracking-[0.15em] text-accent">
              01 · Craftsmanship
            </span>

            <h3 className="text-base font-semibold text-text-primary">
              Curated Quality
            </h3>

            <p className="text-xs leading-relaxed text-text-secondary">
              Every item is designed in-house or sourced directly from artisan
              studios committed to sustainable materials.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-background p-6">
            <span className="font-mono text-2xs font-semibold uppercase tracking-[0.15em] text-accent">
              02 · Eco Conscious
            </span>

            <h3 className="text-base font-semibold text-text-primary">
              Sustainable Packaging
            </h3>

            <p className="text-xs leading-relaxed text-text-secondary">
              100% plastic-free packaging using unbleached kraft paper, organic
              cotton ties, and soy-based inks.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-background p-6">
            <span className="font-mono text-2xs font-semibold uppercase tracking-[0.15em] text-accent">
              03 · Pan-India Shipping
            </span>

            <h3 className="text-base font-semibold text-text-primary">
              Direct from Warehouse
            </h3>

            <p className="text-xs leading-relaxed text-text-secondary">
              Shipped directly from our Bangalore hub with end-to-end tracking
              to over 20,000 pincodes across India.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}