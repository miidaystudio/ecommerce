import type { ReactNode } from 'react';
import { SiteHeader } from '../../components/layout/SiteHeader';

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
