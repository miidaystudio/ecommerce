import Link from 'next/link';
import type { PublicStoreSettings } from '@ecommerce/shared-types';
import { settingsApi } from '../../lib/api/settings.api';

const SHOP_LINKS = [
  { href: '/products', label: 'All products' },
  { href: '/account/orders', label: 'Track an order' },
  { href: '/account/wishlist', label: 'Wishlist' },
];

const INFO_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
];

const POLICY_LINKS = [
  { href: '/policy/returns', label: 'Return policy' },
  { href: '/policy/terms', label: 'Terms of service' },
  { href: '/policy/privacy', label: 'Privacy policy' },
];

function LinkColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h2 className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
        {title}
      </h2>

      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-text-secondary transition hover:text-text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function SiteFooter() {
  // The footer must never be the reason a page fails to render, so a settings
  // outage falls back to the built-in store name.
  let settings: PublicStoreSettings | null = null;

  try {
    settings = await settingsApi.getPublic();
  } catch {
    settings = null;
  }

  const storeName = settings?.storeName ?? 'miiday';
  const freeShippingThreshold = settings?.freeShippingThreshold;

  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 py-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <p className="text-lg font-bold tracking-tight text-text-primary">
            {storeName}
            <span className="text-accent">.</span>
          </p>

          <p className="mt-2 max-w-xs text-sm leading-relaxed text-text-secondary">
            Everything for a slower home — across multiple product categories.
          </p>

          {freeShippingThreshold !== undefined ? (
            <p className="mt-3 text-xs text-text-secondary">
              Free shipping on orders over ₹
              {freeShippingThreshold.toLocaleString('en-IN')}.
            </p>
          ) : null}
        </div>

        <LinkColumn title="Shop" links={SHOP_LINKS} />
        <LinkColumn title="Help" links={INFO_LINKS} />
        <LinkColumn title="Policies" links={POLICY_LINKS} />
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-2xs text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {storeName}. All rights reserved.
          </span>

          {settings?.supportEmail ? (
            <a
              href={`mailto:${settings.supportEmail}`}
              className="transition hover:text-text-primary"
            >
              {settings.supportEmail}
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}