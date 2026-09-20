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
      {/* Hero Section - Minimalist Editorial Bento Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5 items-stretch">
          
          {/* LEFT COLUMN: Main Text Card + 2 Sub-Cards (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4 sm:gap-5">
            
            {/* Top Large Card */}
            <div className="relative flex flex-col justify-between rounded-[2rem] sm:rounded-[2.5rem] bg-[#E3E0D8] p-8 sm:p-10 lg:p-12 min-h-[360px] sm:min-h-[400px] overflow-hidden border border-black/5 shadow-sm">
              
              {/* Badge & Arrow Header */}
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 backdrop-blur-sm px-4 py-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.15em] text-neutral-800">
                  New season · linen &amp; oak
                </span>

                {/* Arrow graphic matching reference screenshot */}
                <div className="hidden sm:flex items-center text-neutral-900 font-light">
                  <div className="w-20 sm:w-28 h-[2px] bg-neutral-900"></div>
                  <svg className="w-5 h-5 -ml-1 text-neutral-900 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Main Headline styled bold uppercase matching reference */}
              <div className="my-6">
                <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-black uppercase tracking-tight text-neutral-950 leading-[0.93] font-sans">
                  EVERYTHING FOR<br />
                  A SLOWER HOME<span className="text-accent">.</span>
                </h1>
              </div>

              {/* Description Paragraph */}
              <div className="mt-auto pt-4 border-t border-black/10">
                <p className="max-w-xl text-sm sm:text-base leading-relaxed font-normal text-neutral-700">
                  A single-vendor marketplace across home, kitchen, beauty, and kids.
                  Curated by one team. Shipped from one warehouse.
                </p>
              </div>
            </div>

            {/* Bottom Row: 2 Sub-Cards */}
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              
              {/* Sub-card 1 */}
              <Link
                href="/products"
                className="group relative flex aspect-[4/3] sm:aspect-[16/10] w-full flex-col justify-end overflow-hidden rounded-[1.75rem] sm:rounded-[2rem] bg-neutral-900 p-5 text-white transition-all duration-300 hover:shadow-lg"
              >
                <img
                  src="https://images.unsplash.com/photo-1507652313519-d4e9174996dd?q=80&w=800&auto=format&fit=crop"
                  alt="Shop new arrivals"
                  className="absolute inset-0 h-full w-full object-cover object-center opacity-85 transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                    #RIP STOP
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </Link>

              {/* Sub-card 2 */}
              <Link
                href="/products"
                className="group relative flex aspect-[4/3] sm:aspect-[16/10] w-full flex-col justify-end overflow-hidden rounded-[1.75rem] sm:rounded-[2rem] bg-neutral-900 p-5 text-white transition-all duration-300 hover:shadow-lg"
              >
                <img
                  src="https://images.unsplash.com/photo-1588854337236-6889d631faa8?q=80&w=800&auto=format&fit=crop"
                  alt="Browse categories"
                  className="absolute inset-0 h-full w-full object-cover object-center opacity-85 transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="relative z-10 flex items-center justify-between">
                  <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                    #INSULATED
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-md text-white transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </Link>

            </div>
          </div>

          {/* RIGHT COLUMN: Featured Image Card with Floating SHOP NOW & Action Pills (5 cols) */}
          <div className="lg:col-span-5 relative flex min-h-[480px] sm:min-h-[560px] flex-col justify-between overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-neutral-900 p-6 sm:p-8 text-white shadow-md">
            
            {/* Background Image matching editorial aesthetic */}
            <img
              src="https://images.unsplash.com/photo-1544441893-675973e31985?q=80&w=1200&auto=format&fit=crop"
              alt="Organic ceramics, raw linen & solid oak"
              className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 hover:scale-105"
            />
            
            {/* Gradient Overlay for contrast */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-black/75"></div>

            {/* Top Collection Tag Overlay */}
            <div className="relative z-10 flex flex-col items-start gap-2">
              <div className="flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md px-3.5 py-1.5 border border-white/15">
                <span className="text-lg">🏺</span>
                <span className="font-mono text-2xs font-semibold uppercase tracking-[0.15em] text-white/90">
                  Handcrafted Essentials · 2026 Collection
                </span>
              </div>
              <h2 className="mt-1 text-lg sm:text-xl font-medium tracking-tight text-white/95 max-w-xs drop-shadow">
                Organic ceramics, raw linen &amp; solid oak
              </h2>
            </div>

            {/* Floating "SHOP NOW" Circular Glassmorphism Badge */}
            <Link
              href="/products"
              className="absolute right-6 sm:right-10 top-1/2 -translate-y-1/2 z-20 flex h-24 w-24 sm:h-28 sm:w-28 flex-col items-center justify-center rounded-full border border-white/40 bg-white/20 backdrop-blur-md p-2 text-center text-white shadow-xl transition-all duration-300 hover:scale-110 hover:bg-white/30 hover:border-white"
            >
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider leading-tight">
                SHOP<br />NOW
              </span>
            </Link>

            {/* Bottom Floating Action Pills */}
            <div className="relative z-10 mt-auto flex flex-wrap items-center gap-3 pt-6">
              
              {/* Primary Action Pill */}
              <Link
                href="/products"
                className="group flex h-12 items-center gap-3 rounded-full bg-white px-6 text-xs sm:text-sm font-bold uppercase tracking-wider text-neutral-900 transition-all duration-300 hover:bg-neutral-100 hover:shadow-lg"
              >
                <span>Shop new arrivals</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white transition-transform duration-300 group-hover:rotate-45">
                  ↓
                </span>
              </Link>

              {/* Secondary Action Pill */}
              <Link
                href="/products"
                className="group flex h-12 items-center gap-3 rounded-full border border-white/30 bg-white/20 backdrop-blur-md px-6 text-xs sm:text-sm font-bold uppercase tracking-wider text-white transition-all duration-300 hover:bg-white/30 hover:border-white"
              >
                <span>Browse categories</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white transition-transform duration-300 group-hover:translate-x-0.5">
                  ✉
                </span>
              </Link>

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