'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ProductSummary } from '@ecommerce/shared-types';
import { useCartStore } from '../../store/cartStore';
import { resolveImageUrl } from '../../lib/utils/image-url';
import { formatPrice } from '../../lib/utils/format-price';

import { productsApi } from '../../lib/api/products.api';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const CATALOG_ITEMS = [
  {
    id: 'ess-9',
    name: 'TAILORED STRUCTURED BLAZER',
    price: '₹15,000',
    tag: 'ATELIER 2026',
    category: 'OUTERWEAR',
    image: '/blazer-essential.png',
    slug: 'tailored-structured-blazer',
  },
  {
    id: 'ess-1',
    name: 'OVERSIZED RAW-EDGE BLAZER',
    price: '₹14,999',
    tag: 'NEW 2026',
    category: 'OUTERWEAR',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop',
    slug: 'oversized-raw-edge-blazer',
  },
  {
    id: 'ess-2',
    name: 'CORDUROY OVERSHIRT // INK',
    price: '₹1,499',
    tag: 'BEST SELLER',
    category: 'SUMMER 2026',
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800&auto=format&fit=crop',
    slug: 'corduroy-overshirt-ink',
  },
  {
    id: 'ess-3',
    name: 'ARCHITECTURAL CHINO TROUSER',
    price: '₹8,499',
    tag: 'ESSENTIAL',
    category: 'SUMMER 2026',
    image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=800&auto=format&fit=crop',
    slug: 'architectural-chino-trouser',
  },
  {
    id: 'ess-4',
    name: 'TACTICAL RIPSTOP ANORAK',
    price: '₹12,499',
    tag: 'RIPSTOP',
    category: 'OUTERWEAR',
    image: 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?q=80&w=800&auto=format&fit=crop',
    slug: 'tactical-ripstop-anorak',
  },
  {
    id: 'ess-5',
    name: 'STRUCTURED HEAVYWEAVE PARKA',
    price: '₹19,200',
    tag: 'LIMITED',
    category: 'OUTERWEAR',
    image: 'https://images.unsplash.com/photo-1544441893-675973e31985?q=80&w=800&auto=format&fit=crop',
    slug: 'structured-heavyweave-parka',
  },
  {
    id: 'ess-6',
    name: 'MINIMALIST MERINO CARDIGAN',
    price: '₹11,800',
    tag: 'MERINO',
    category: 'SUMMER 2026',
    image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=800&auto=format&fit=crop',
    slug: 'minimalist-merino-cardigan',
  },
  {
    id: 'ess-7',
    name: 'ARCHIVAL KNIT BEANIE',
    price: '₹3,499',
    tag: 'HEADWEAR',
    category: 'HEADWEAR',
    image: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?q=80&w=800&auto=format&fit=crop',
    slug: 'archival-knit-beanie',
  },
  {
    id: 'ess-8',
    name: 'STRUCTURED UTILITY CAP',
    price: '₹2,999',
    tag: 'HEADWEAR',
    category: 'HEADWEAR',
    image: 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?q=80&w=800&auto=format&fit=crop',
    slug: 'structured-utility-cap',
  },
];

const FILTER_TABS = ['ALL ESSENTIALS', 'SUMMER 2026', 'HEADWEAR', 'OUTERWEAR'];

export function EditorialLanding({ initialProducts = [] }: { initialProducts?: ProductSummary[] }) {
  const [activeTab, setActiveTab] = useState('ALL ESSENTIALS');
  const [quickAddedId, setQuickAddedId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>(initialProducts);
  const addItem = useCartStore((s) => s.addItem);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    productsApi
      .list({ sort: 'newest', pageSize: 12 })
      .then((res) => {
        if (!cancelled && res.items.length > 0) {
          setProducts(res.items);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const displayItems = useMemo(() => {
    if (products && products.length > 0) {
      const backendItems = products.map((p) => {
        const categoryName = p.category?.name?.toUpperCase() || 'NEW ARRIVAL';
        let category = 'SUMMER 2026';
        if (categoryName.includes('HEADWEAR') || categoryName.includes('CAP') || categoryName.includes('HAT')) {
          category = 'HEADWEAR';
        } else if (categoryName.includes('OUTERWEAR') || categoryName.includes('JACKET') || categoryName.includes('PARKA') || categoryName.includes('BLAZER')) {
          category = 'OUTERWEAR';
        }
        return {
          id: p.id,
          name: p.name.toUpperCase(),
          price: formatPrice(p.price),
          tag: categoryName,
          category,
          image: p.image?.url ? resolveImageUrl(p.image.url) : 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop',
          slug: p.slug,
        };
      });
      if (backendItems.length < 8) {
        return [...backendItems, ...CATALOG_ITEMS.slice(backendItems.length)];
      }
      return backendItems;
    }
    return CATALOG_ITEMS;
  }, [products]);

  useEffect(() => {
    if (!rootRef.current) return;
    const ctx = gsap.context(() => {
      // Staggered reveals on scroll
      const sections = rootRef.current?.querySelectorAll('.gsap-reveal');
      sections?.forEach((el) => {
        gsap.fromTo(
          el,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1,
            stagger: 0.08,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              toggleActions: 'play none none none',
            },
          }
        );
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  const handleQuickAdd = async (item: (typeof displayItems)[0]) => {
    try {
      const product = await productsApi.getBySlug(item.slug);
      const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
      if (!defaultVariant) return;

      const mainImage = product.images[0];
      await addItem(
        defaultVariant,
        { id: product.id, name: product.name, slug: product.slug },
        mainImage ? { url: mainImage.url, altText: mainImage.altText } : { url: item.image, altText: item.name },
        1,
      );
      setQuickAddedId(item.id);
      setTimeout(() => setQuickAddedId(null), 1800);
    } catch {
      const priceNum = parseInt(item.price.replace(/[^\d]/g, ''), 10) || 9999;
      await addItem(
        {
          id: item.id,
          sku: `SKU-${item.id}`,
          name: 'Standard',
          attributes: null,
          price: priceNum,
          compareAtPrice: null,
          stock: 10,
          isDefault: true,
        },
        { id: item.id, name: item.name, slug: item.slug },
        { url: item.image, altText: item.name },
        1,
      );
      setQuickAddedId(item.id);
      setTimeout(() => setQuickAddedId(null), 1800);
    }
  };

  const filteredItems = activeTab.startsWith('ALL')
    ? displayItems
    : displayItems.filter((i) => i.category === activeTab);

  return (
    <div ref={rootRef} className="w-full bg-[#F9F8F5] text-[#121212] font-sans">
      <div className="max-w-6xl mx-auto px-6 py-8 sm:py-12 space-y-12 sm:space-y-16">
        
        {/* 1. COMPACT HERO BENTO GRID */}
        <section className="gsap-reveal grid grid-cols-1 lg:grid-cols-12 gap-4 max-h-none lg:max-h-[520px]">
          
          {/* Left Bento Column */}
          <div className="lg:col-span-6 flex flex-col gap-4 justify-between">
            
            {/* Top Light Stone Editorial Card */}
            <div className="bg-[#ECE9E2] rounded-[1.75rem] p-7 flex flex-col justify-between flex-1 min-h-[260px] border border-black/[0.06] transition-transform duration-500 ease-out hover:scale-[1.01] shadow-2xs">
              <div>
                <div className="text-3xs font-mono tracking-[0.2em] text-neutral-500 uppercase mb-3">
                  NEW SEASON TELEMETRY // 2026
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-[-0.04em] uppercase leading-[0.95] text-neutral-950">
                  <span className="inline-flex items-center gap-2.5 w-full">
                    <span>FOR</span>
                    <span className="flex-1 flex items-center">
                      <span className="h-[2.5px] flex-1 bg-neutral-950 inline-block"></span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="shrink-0 -ml-1 text-neutral-950">
                        <path d="M2 1.5L10.5 6L2 10.5V1.5Z" />
                      </svg>
                    </span>
                  </span>
                  <span className="block mt-1">EVERYONE BUT NOT ANYONE</span>
                </h1>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <p className="text-neutral-600 text-xs leading-relaxed max-w-xs font-medium">
                  We believe personal relevance is paramount; creating tailored artifacts for each unique individual.
                </p>
                <Link
                  href="/products"
                  className="bg-neutral-950 text-white text-xs font-mono px-4 py-2.5 rounded-full hover:scale-105 transition-transform shrink-0 self-start sm:self-end shadow-xs flex items-center gap-1.5 font-bold"
                >
                  <span>SHOP NOW</span>
                  <span>↗</span>
                </Link>
              </div>
            </div>

            {/* Bottom Dual Thumbnails */}
            <div className="grid grid-cols-2 gap-4 h-36 sm:h-40">
              
              {/* Card 1: #RIPSTOP */}
              <Link
                href="/products"
                className="relative rounded-[1.25rem] overflow-hidden group h-full block bg-neutral-900 border border-black/[0.06] transition-transform duration-500 ease-out hover:scale-[1.02]"
              >
                <img
                  src="https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?q=80&w=800&auto=format&fit=crop"
                  alt="#RIPSTOP"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
                <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-mono px-2.5 py-1 rounded-full border border-white/10 uppercase tracking-wider">
                  #RIPSTOP ↗
                </span>
              </Link>

              {/* Card 2: #INSULATED */}
              <Link
                href="/products"
                className="relative rounded-[1.25rem] overflow-hidden group h-full block bg-neutral-950 border border-black/[0.06] transition-transform duration-500 ease-out hover:scale-[1.02]"
              >
                <img
                  src="https://images.unsplash.com/photo-1588854337236-6889d631faa8?q=80&w=800&auto=format&fit=crop"
                  alt="#INSULATED"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
                <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-mono px-2.5 py-1 rounded-full border border-white/10 uppercase tracking-wider">
                  #INSULATED ↗
                </span>
              </Link>

            </div>

          </div>

          {/* Right Hero Visual */}
          <div className="lg:col-span-6 rounded-[1.75rem] overflow-hidden relative min-h-[420px] lg:h-full max-h-[520px] bg-[#0a0a0a] group border border-black/[0.06] shadow-sm flex items-center justify-center p-2">
            <img
              src="/hero-editorial.png"
              alt="Miiday Studio Editorial Showcase"
              className="w-full h-full object-contain object-center group-hover:scale-[1.02] transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10"></div>

            {/* Bottom Glassmorphic Capsule Dock */}
            <div className="absolute bottom-4 inset-x-4 flex items-center justify-between">
              <div className="backdrop-blur-md bg-white/80 px-3.5 py-2 rounded-full border border-white/40 flex items-center gap-2 text-xs font-mono font-medium shadow-md">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>ATELIER EDITION // 2026</span>
              </div>
              <Link
                href="/products"
                className="backdrop-blur-md bg-neutral-950/90 text-white px-4 py-2 rounded-full border border-white/20 text-xs font-mono font-bold hover:bg-neutral-950 transition"
              >
                EXPLORE FLEET ↗
              </Link>
            </div>
          </div>

        </section>

        {/* 2. EDITORIAL RUNNING STATEMENT (Callout) */}
        <section className="gsap-reveal max-w-3xl mx-auto text-center py-8 sm:py-12 px-4">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 leading-snug">
            Puremod Clothing
            <span className="w-7 h-7 rounded-full inline-block align-middle mx-1.5 border border-black/10 overflow-hidden shadow-2xs relative top-[-2px]">
              <img
                src="https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=200&auto=format&fit=crop"
                alt=""
                className="w-full h-full object-cover"
              />
            </span>
            for Elevated Everyday Life. Styles change
            <span className="font-mono text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-black/[0.08] bg-[#F3F0EA] inline-flex items-center gap-1 mx-1.5 shadow-2xs">
              ✦ with seasons ✦
            </span>
            united by the liberating essence of travel-inspired lightheartedness.
          </h2>
        </section>

        {/* 3. "SHOP BY ESSENTIALS" (Balanced 3-Column Catalog) */}
        <section className="gsap-reveal space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="font-mono text-xs text-neutral-500 uppercase tracking-widest block mb-1">
                CURATED SELECTION //
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-neutral-950">
                SHOP BY ESSENTIALS
              </h2>
            </div>

            {/* Filter Dock */}
            <div className="flex flex-wrap items-center gap-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={
                    activeTab === tab
                      ? 'bg-neutral-950 text-white font-mono text-xs px-3.5 py-1 rounded-full shadow-xs font-medium transition-colors'
                      : 'bg-transparent hover:bg-neutral-200/60 text-neutral-600 font-mono text-xs px-3 py-1 rounded-full border border-black/[0.08] transition-colors'
                  }
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog Grid (5 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
            {filteredItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="group flex flex-col justify-between"
              >
                {/* Image Window */}
                <div className="aspect-[4/5] rounded-2xl bg-[#EFECE6] overflow-hidden relative group border border-black/[0.05] shadow-2xs">
                  <Link href={`/products/${item.slug}`} className="block w-full h-full">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </Link>
                  <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-[10px] font-mono px-2 py-0.5 rounded-md uppercase tracking-wider font-bold text-neutral-900 border border-black/5 pointer-events-none">
                    {item.tag}
                  </span>

                  {/* Quick Add Pill */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleQuickAdd(item);
                    }}
                    className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 absolute bottom-3 inset-x-3 bg-neutral-950/90 backdrop-blur-md text-white font-mono text-xs py-2 rounded-xl text-center shadow-lg font-bold hover:bg-black z-10"
                  >
                    {quickAddedId === item.id ? '✓ ADDED TO BAG' : '[ QUICK ADD + ]'}
                  </button>
                </div>

                {/* Info Row */}
                <div className="mt-3 flex items-baseline justify-between font-mono">
                  <Link href={`/products/${item.slug}`} className="text-xs font-black tracking-tight uppercase text-neutral-950 truncate max-w-[70%] hover:text-emerald-600 transition-colors">
                    {item.name}
                  </Link>
                  <span className="font-mono text-xs text-neutral-500 font-medium shrink-0">
                    {item.price}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Explore More Button */}
          <div className="mt-10 flex justify-center">
            <Link
              href="/products"
              className="bg-neutral-950 hover:bg-neutral-900 text-white font-mono text-xs font-bold px-8 py-3.5 rounded-full transition-transform hover:scale-105 shadow-md flex items-center gap-2 uppercase tracking-wider"
            >
              <span>EXPLORE MORE PRODUCTS</span>
              <span>↗</span>
            </Link>
          </div>
        </section>

        {/* 4. SUSTAINABILITY & ATELIER BANNERS */}
        <section className="gsap-reveal space-y-6">
          
          {/* Banner 1: Sage Green Manifesto Block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[380px] sm:min-h-[420px]">
            
            {/* Left portrait photo card */}
            <div className="lg:col-span-4 rounded-[2rem] overflow-hidden relative border border-black/[0.06] shadow-sm group min-h-[340px] lg:min-h-full bg-neutral-900">
              <img
                src="/sustainability-person.jpg"
                alt="Miiday Atelier Craftsman"
                className="w-full h-full object-cover object-center group-hover:scale-103 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
              
              {/* Bottom-left capsule button */}
              <Link
                href="/about"
                className="absolute bottom-5 left-5 bg-white/90 hover:bg-white text-neutral-950 text-xs font-mono font-bold px-4 py-2 rounded-full backdrop-blur-md transition shadow-md border border-white/40 flex items-center gap-1.5 uppercase"
              >
                <span>LEARN MORE</span>
                <span>↗</span>
              </Link>
            </div>

            {/* Right olive/sage green container */}
            <div className="lg:col-span-8 bg-[#687C49] text-[#121B0A] rounded-[2rem] p-7 sm:p-10 flex flex-col justify-between shadow-xs border border-black/[0.06]">
              <div>
                <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black uppercase tracking-[-0.03em] leading-[0.95] text-[#121B0A] max-w-xl">
                  WE&apos;RE CHANGING THE WAY THINGS GET MADE
                </h2>
              </div>

              {/* Bottom twin feature card */}
              <div className="mt-8 bg-[#586A3E]/40 border border-[#485732]/30 rounded-2xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 backdrop-blur-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#121B0A] text-white flex items-center justify-center font-bold text-[10px]">
                      ✦
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#121B0A]">
                      SUSTAINABILITY
                    </h4>
                  </div>
                  <p className="text-xs text-[#1E2E11]/90 leading-relaxed font-sans font-medium">
                    We&apos;re challenging conventional retail, putting an end to dead stock, unconventional waste and more fantastic zero-waste artifacts.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#121B0A] text-white flex items-center justify-center font-bold text-[10px]">
                      ⚡
                    </div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-[#121B0A]">
                      MISSION
                    </h4>
                  </div>
                  <p className="text-xs text-[#1E2E11]/90 leading-relaxed font-sans font-medium">
                    We&apos;re on a mission to empower create independence in a commercial world and incredible high-fashion engineering.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Banner 2: Full Atelier Panoramic Window */}
          <div className="w-full h-72 rounded-2xl overflow-hidden relative group border border-black/[0.06] shadow-sm flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=1600&auto=format&fit=crop"
              alt="Atelier workshop"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>

            <Link
              href="/about"
              className="relative z-10 backdrop-blur-md bg-white/90 text-neutral-950 font-mono text-xs font-black uppercase tracking-wider px-6 py-3 rounded-full shadow-xl hover:bg-white transition hover:scale-105 border border-white/40"
            >
              [ EXPLORE THE ATELIER ↗ ]
            </Link>
          </div>

        </section>

      </div>
    </div>
  );
}
