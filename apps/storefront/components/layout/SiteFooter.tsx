'use client';

import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface text-text-primary">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:gap-12">
          {/* Brand Col */}
          <div className="md:col-span-1">
            <Link href="/" className="text-xl font-bold tracking-tight text-text-primary">
              miiday<span className="text-accent">.</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              A single-vendor marketplace across home, kitchen, beauty, and apparel. Curated with care, shipped from one warehouse.
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h3 className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Categories
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/products?category=home" className="hover:text-primary transition">
                  Home &amp; Living
                </Link>
              </li>
              <li>
                <Link href="/products?category=fashion" className="hover:text-primary transition">
                  Fashion &amp; Linen
                </Link>
              </li>
              <li>
                <Link href="/products?category=beauty" className="hover:text-primary transition">
                  Beauty &amp; Skincare
                </Link>
              </li>
              <li>
                <Link href="/products?category=kitchen" className="hover:text-primary transition">
                  Kitchen &amp; Tableware
                </Link>
              </li>
              <li>
                <Link href="/products?category=kids" className="hover:text-primary transition">
                  Kids &amp; Nursery
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div>
            <h3 className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Help &amp; Care
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/cart" className="hover:text-primary transition">
                  Your Cart
                </Link>
              </li>
              <li>
                <Link href="/account" className="hover:text-primary transition">
                  Track Order
                </Link>
              </li>
              <li>
                <span className="cursor-pointer hover:text-primary transition">Shipping &amp; Returns</span>
              </li>
              <li>
                <span className="cursor-pointer hover:text-primary transition">Sustainability</span>
              </li>
              <li>
                <span className="cursor-pointer hover:text-primary transition">Contact Support</span>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Stay Connected
            </h3>
            <p className="mt-3 text-xs text-text-secondary">
              Subscribe for new seasonal arrivals and exclusive previews.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="mt-3 flex gap-2">
              <input
                type="email"
                placeholder="Your email address"
                className="h-10 w-full rounded border border-border bg-background px-3 text-xs text-text-primary outline-none transition focus:border-primary"
              />
              <button
                type="submit"
                className="h-10 shrink-0 rounded bg-primary px-4 text-xs font-medium text-primary-foreground transition hover:bg-primary-hover"
              >
                Join
              </button>
            </form>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-text-secondary sm:flex-row">
          <p>© {new Date().getFullYear()} miiday studio. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="hover:text-text-primary cursor-pointer transition">Privacy Policy</span>
            <span className="hover:text-text-primary cursor-pointer transition">Terms of Service</span>
            <span className="hover:text-text-text-primary cursor-pointer transition">Instagram</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
