import { SiteHeader } from '../../components/layout/SiteHeader';
import { SiteFooter } from '../../components/layout/SiteFooter';

// SiteFooter reads store settings. Without a revalidate window these pages are
// prerendered once, so a build that ran while the API was unreachable would
// keep the fallback footer (no support email) until the next deploy.
export const revalidate = 300;

// Shared chrome and a single measured column for every info/policy page, so
// body copy stays inside design.md's 65-75 character target on desktop.
export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-14">{children}</main>
      <SiteFooter />
    </>
  );
}
