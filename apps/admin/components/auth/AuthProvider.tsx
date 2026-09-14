'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../lib/hooks/useAuth';
import { hasSessionHint } from '../../lib/utils/session-hint';

const LOGIN_PATH = '/login';
const CHANGE_PASSWORD_PATH = '/change-password';

/**
 * Restores the session, holds non-public pages until that resolves, and does
 * all auth routing: sign-in, the forced password change, and leaving /login once
 * signed in.
 *
 * Routing lives here rather than in the edge middleware because only this layer
 * has the verified user — the middleware can't see the API's cookie when the
 * API is on another site. Each redirect targets a single destination from a
 * resolved status, so the pages can't bounce between each other.
 *
 * Holding pages until restore resolves also matters for data: a page loaded
 * directly (reload, deep link, "View invoice" in a new tab) would otherwise
 * fetch before the access token is in memory and get a 401.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { bootstrap, status, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const onLogin = pathname === LOGIN_PATH;
  const onChangePassword = pathname === CHANGE_PASSWORD_PATH;
  const mustChangePassword = Boolean(user?.mustChangePassword);

  // A transient failure (429, 5xx, offline) keeps the session hint — see
  // useAuth — so it gets a retry rather than a trip to /login.
  const sessionGone = status === 'unauthenticated' && !hasSessionHint();
  const transientFailure = status === 'unauthenticated' && !sessionGone;

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const destination =
    status === 'authenticated'
      ? mustChangePassword
        ? onChangePassword
          ? null
          : CHANGE_PASSWORD_PATH
        : onLogin || onChangePassword
          ? '/'
          : null
      : sessionGone && !onLogin
        ? LOGIN_PATH
        : null;

  useEffect(() => {
    if (destination) {
      router.replace(destination);
    }
  }, [destination, router]);

  if (onLogin) {
    // The sign-in form stays usable while a restore is pending or has failed.
    return destination ? <Holding /> : <>{children}</>;
  }

  if (transientFailure) {
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

  if (status !== 'authenticated' || destination) {
    return <Holding />;
  }

  return <>{children}</>;
}

function Holding() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-text-secondary">Loading…</p>
    </div>
  );
}
