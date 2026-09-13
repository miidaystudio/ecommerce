import type { ReactNode } from 'react';
import { SiteHeader } from '../../components/layout/SiteHeader';
import { SiteFooter } from '../../components/layout/SiteFooter';

// SiteFooter reads store settings. Without a revalidate window these pages are
// prerendered once, so a build that ran while the API was unreachable would
// keep the fallback footer (no support email) until the next deploy.
export const revalidate = 300;

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}