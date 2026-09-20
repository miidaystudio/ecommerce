import Link from 'next/link';
import type { BannerView } from '@ecommerce/shared-types';
import { bannersApi } from '../../lib/api/banners.api';
import { productsApi } from '../../lib/api/products.api';
import { ApiError } from '../../lib/api/client';
import { HomeBanners } from '../../components/layout/HomeBanners';
import { ProductCard } from '../../components/product/ProductCard';
import { RecentlyViewedStrip } from '../../components/product/RecentlyViewed';

export const revalidate = 60;

const ESSENTIALS_ITEMS = [
  {
    id: '1',
    name: 'CORD SHIRT',
    price: '₹1,499',
    tag: 'BEST SELLER',
    tagBg: 'bg-neutral-950 text-white',
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800&auto=format&fit=crop',
    productUrl: '/products',
  },
  {
    id: '2',
    name: 'CPO SHIRT',
    price: '₹1,999',
    tag: '15% OFF',
    tagBg: 'bg-[#E2DDD2] text-neutral-900 border border-neutral-300',
    image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=800&auto=format&fit=crop',
    productUrl: '/products',
  },
  {
    id: '3',
    name: 'SUMMER T-SHIRT',
    price: '₹1,199',
    tag: null,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop',
    productUrl: '/products',
  },
  {
    id: '4',
    name: 'T-SHIRTS',
    price: '₹899',
    tag: null,
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=800&auto=format&fit=crop',
    productUrl: '/products',
  },
  {
    id: '5',
    name: 'CARDIGAN',
    price: '₹2,299',
    tag: null,
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop',
    productUrl: '/products',
  },
  {
    id: '6',
    name: 'JACKET CASUALV',
    price: '₹3,299',
    tag: null,
    image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?q=80&w=800&auto=format&fit=crop',
    productUrl: '/products',
  },
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

  let banners: BannerView[] = [];
  try {
    banners = await bannersApi.listActive();
  } catch {
    banners = [];
  }

  return (
    <div className="flex flex-col gap-14 pb-20 bg-[#FDFDFD] text-neutral-900 font-sans">
      
      {/* 1. EDITORIAL BENTO HERO CLUSTER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* Left Column (lg:col-span-6) */}
          <div className="lg:col-span-6 flex flex-col gap-5 justify-between">
            
            {/* Top Light Stone Editorial Card */}
            <div className="flex-1 bg-[#ECE9E2] rounded-[2.25rem] p-8 sm:p-10 flex flex-col justify-between relative min-h-[340px]">
              <div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-[-0.04em] leading-[0.95] text-neutral-950 uppercase flex items-center gap-3">
                  <span>FOR</span>
                  <span className="h-[2px] flex-1 bg-neutral-950 inline-block relative">
                    <span className="absolute right-0 -top-[5px] text-xs font-bold">►</span>
                  </span>
                </h1>
                <h2 className="text-3xl sm:text-5xl font-black tracking-[-0.04em] leading-[0.95] text-neutral-950 uppercase mt-1">
                  EVERYONE BUT NOTANYONE
                </h2>
              </div>

              <div className="mt-8 pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <p className="text-neutral-600 text-xs sm:text-sm leading-relaxed max-w-[300px] font-medium">
                  We believe personal relevance is paramount; our goal is to make items that feel unique and tailor-made for each unique individual.
                </p>
                <Link
                  href="/products"
                  className="bg-neutral-950 hover:bg-neutral-800 text-white font-mono text-xs font-semibold px-5 py-3 rounded-full transition-all duration-200 shrink-0 self-start sm:self-end shadow-md"
                >
                  SHOP NOW →
                </Link>
              </div>
            </div>

            {/* Bottom Dual Split Cards */}
            <div className="grid grid-cols-2 gap-4 h-48 sm:h-56">
              
              {/* Card 1: #RIP STOP */}
              <Link
                href="/products"
                className="relative rounded-[1.75rem] overflow-hidden group h-full block bg-neutral-900"
              >
                <img
                  src="https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?q=80&w=800&auto=format&fit=crop"
                  alt="#RIP STOP"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white font-mono text-[11px] px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-wider">
                  #RIP STOP ↗
                </span>
              </Link>

              {/* Card 2: #INSULATED */}
              <Link
                href="/products"
                className="relative rounded-[1.75rem] overflow-hidden group h-full block bg-neutral-950"
              >
                <img
                  src="https://images.unsplash.com/photo-1588854337236-6889d631faa8?q=80&w=800&auto=format&fit=crop"
                  alt="#INSULATED"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
                <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white font-mono text-[11px] px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-wider">
                  #INSULATED ↗
                </span>
              </Link>

            </div>

          </div>

          {/* Right Column Showcase Hero (lg:col-span-6) */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="h-full min-h-[480px] lg:min-h-[580px] rounded-[2.25rem] overflow-hidden relative group shadow-md">
              <img
                src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=1200&auto=format&fit=crop"
                alt="Puremod Clothing collection"
                className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10"></div>

              {/* Top Right Floating Circle Tag */}
              <Link
                href="/products"
                className="absolute top-6 right-6 w-16 h-16 rounded-full bg-white/30 backdrop-blur-md border border-white/40 text-white font-mono text-2xs font-bold flex items-center justify-center text-center uppercase tracking-wider hover:bg-white hover:text-black transition-all"
              >
                SHOP<br />NOW
              </Link>

              {/* Bottom Floating Action Dock */}
              <div className="absolute bottom-6 left-6 right-6 sm:right-auto flex items-center gap-3">
                <Link
                  href="/products"
                  className="bg-white hover:bg-neutral-100 text-neutral-950 font-mono text-xs font-bold px-5 py-3 rounded-full shadow-lg transition-all flex items-center gap-2"
                >
                  <span>EXPLORE SHOP ↗</span>
                </Link>
                <Link
                  href="/about"
                  className="bg-black/40 hover:bg-black/60 backdrop-blur-md text-white border border-white/20 font-mono text-xs px-5 py-3 rounded-full transition-all"
                >
                  <span>OUR PHILOSOPHY ↗</span>
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 2. INLINE EDITORIAL RUNNING STATEMENT */}
      <section className="max-w-4xl mx-auto px-6 py-10 text-center">
        <h2 className="text-xl sm:text-3xl font-bold tracking-tight text-neutral-900 leading-snug">
          Puremod Clothing 🧢 for Elevated Everyday Life. Styles change{' '}
          <span className="font-mono text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-neutral-300 bg-white inline-flex items-center gap-1 mx-1 shadow-2xs">
            ✦ WITH SEASONS
          </span>{' '}
          united by the liberating essence of travel-inspired 🗿 lightheartedness 👤
        </h2>
      </section>

      {/* 3. SHOP BY ESSENTIALS GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
            SHOP BY ESSENTIALS
          </h2>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button className="bg-neutral-950 text-white rounded-full px-4 py-1.5 font-bold shadow-xs">
              ALL (08)
            </button>
            <button className="bg-neutral-200/60 hover:bg-neutral-200 text-neutral-700 rounded-full px-3.5 py-1.5 transition-colors">
              WINTER WEAR
            </button>
            <button className="bg-neutral-200/60 hover:bg-neutral-200 text-neutral-700 rounded-full px-3.5 py-1.5 transition-colors">
              HEAVY WEAR
            </button>
            <button className="bg-neutral-200/60 hover:bg-neutral-200 text-neutral-700 rounded-full px-3.5 py-1.5 transition-colors">
              BEST SELLER
            </button>
            <button className="bg-neutral-200/60 hover:bg-neutral-200 text-neutral-700 rounded-full px-3.5 py-1.5 transition-colors">
              PLAIN SHIRTS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ESSENTIALS_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.productUrl}
              className="group flex flex-col justify-between rounded-3xl bg-white border border-neutral-200/70 shadow-2xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
            >
              <div>
                {/* Top Image Window */}
                <div className="aspect-square bg-[#EFECE6] rounded-2xl m-3 relative overflow-hidden group">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {item.tag && (
                    <span className={`absolute top-3 left-3 text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs ${item.tagBg}`}>
                      {item.tag}
                    </span>
                  )}
                </div>

                {/* Bottom Product Info */}
                <div className="px-5 pb-5 pt-2 flex flex-col gap-1">
                  <h3 className="text-sm font-black tracking-tight uppercase text-neutral-950 group-hover:text-neutral-700 transition-colors">
                    {item.name}
                  </h3>
                  <p className="font-mono text-xs text-neutral-500 font-semibold">
                    {item.price}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. EDITORIAL PROMO BANNERS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex flex-col gap-6">
        
        {/* Banner 1: Olive Green Feature Block */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* Left portrait card */}
          <div className="lg:col-span-4 rounded-3xl overflow-hidden relative min-h-[360px] bg-neutral-900 shadow-md">
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop"
              alt="Model feature"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
            <Link
              href="/products"
              className="absolute bottom-5 left-5 bg-white/95 backdrop-blur-xs font-mono text-xs font-black uppercase text-neutral-950 px-5 py-2.5 rounded-full shadow-lg hover:bg-white transition"
            >
              LEARN MORE ↗
            </Link>
          </div>

          {/* Right olive green container */}
          <div className="lg:col-span-8 bg-[#597042] text-white rounded-3xl p-8 sm:p-12 flex flex-col justify-between shadow-md">
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-[46px] font-black uppercase leading-tight tracking-tight text-white max-w-xl">
                WE'RE CHANGING THE WAY THINGS GET MADE
              </h2>
            </div>

            <div className="mt-10 rounded-2xl bg-black/15 backdrop-blur-md p-6 border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-6 font-sans">
              <div>
                <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                  <span>🌱</span> SUSTAINABILITY
                </h4>
                <p className="text-xs text-white/90 mt-2 leading-relaxed font-medium">
                  We're challenging conventional supply chains, replacing fast production with conscious, zero-waste craftsmanship.
                </p>
              </div>

              <div>
                <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                  <span>🎯</span> MISSION
                </h4>
                <p className="text-xs text-white/90 mt-2 leading-relaxed font-medium">
                  We're on a mission to prove that elevated design and zero compromise can co-exist at scale.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Banner 2: WANT TO DESIGN YOUR OWN */}
        <div className="w-full flex flex-col items-center gap-6 mt-8">
          <div className="text-center">
            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-neutral-950">
              WANT TO DESIGN YOUR OWN? CALM, WE CAN DO IT
            </h2>
          </div>

          <div className="w-full rounded-3xl aspect-[16/7] sm:aspect-[21/9] bg-neutral-100 overflow-hidden relative flex items-center justify-center shadow-md group">
            <img
              src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=1600&auto=format&fit=crop"
              alt="Design your own apparel"
              className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>

            <Link
              href="/contact"
              className="relative z-10 bg-white/95 backdrop-blur-md text-neutral-950 font-mono text-xs font-black uppercase tracking-wider px-7 py-3.5 rounded-full shadow-2xl hover:bg-white transition hover:scale-105"
            >
              [ CLICK TO LEARN MORE ]
            </Link>
          </div>
        </div>

      </section>

      {/* Dynamic merchandising banners */}
      <HomeBanners banners={banners} />

      {/* 5. LOVED THIS MONTH / CATALOG PRODUCTS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-4">
        <div className="mb-8 flex items-baseline justify-between">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-neutral-500 block mb-1">
              OUR CATALOG //
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
              Loved this month
            </h2>
          </div>

          <Link
            href="/products"
            className="font-mono text-xs font-bold text-neutral-600 hover:text-neutral-950 uppercase"
          >
            More products →
          </Link>
        </div>

        {error ? (
          <p className="text-sm text-red-500 font-mono">{error}</p>
        ) : featured && featured.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {featured.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center shadow-xs">
            <p className="text-sm font-mono text-neutral-500">
              No featured items currently in inventory.
            </p>
          </div>
        )}
      </section>

      {/* Recently Viewed */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <RecentlyViewedStrip />
      </div>

    </div>
  );
}
