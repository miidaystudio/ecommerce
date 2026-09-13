'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';
import { hasSessionHint } from '../../lib/utils/session-hint';

const PUBLIC_PATHS = new Set(['/login']);

/**
 * Restores the session, and holds every non-public page back until that has
 * resolved.
 *
 * Without the hold, a page loaded directly (a reload, a deep link, or "View
 * invoice" opening in a new tab) fetched its data before the restore had put an
 * access token in memory: React runs a child's effects before its parent's, so
 * the page's request always went first, came back 401, and was never retried.
 * The storefront avoids this by having each page wait on `status`; here one
 * gate covers every admin page, including ones added later.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { bootstrap, status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // The edge middleware only sees that a refresh cookie exists; if restoring
  // from it fails (expired, revoked, account blocked), send the user to sign in
  // rather than leaving a page whose every request will 401.
  //
  // A transient failure (429, server error, offline) leaves the session hint in
  // place — see useAuth — so it gets a retry rather than a redirect. Redirecting
  // would hit the middleware, which still sees the refresh cookie and sends the
  // browser straight back here.
  const sessionGone = status === 'unauthenticated' && !hasSessionHint();

  useEffect(() => {
    if (!isPublic && sessionGone) {
      router.replace('/login');
    }
  }, [isPublic, sessionGone, router]);

  if (!isPublic && status === 'unauthenticated' && !sessionGone) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-sm text-text-primary">We couldn&apos;t restore your session just now.</p>
        <button
          type="button"
          onClick={() => void bootstrap()}
          className="h-10 rounded bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!isPublic && status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-text-secondary">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
