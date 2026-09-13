import { NextRequest, NextResponse } from 'next/server';

const ADMIN_ROLES = new Set(['STAFF', 'SUPER_ADMIN']);
const COOKIE_NAME = process.env.REFRESH_COOKIE_NAME ?? 'refresh_token';

// Soft UX gate only. The backend RolesGuard is the real authorization boundary;
// the JWT signature is intentionally not verified here (no secret on the edge).
interface TokenPayload {
  role?: string;
  mustChangePassword?: boolean;
}

// Soft UX gate only. The backend RolesGuard is the real authorization boundary;
// the JWT signature is intentionally not verified here (no secret on the edge).
function readTokenPayload(token: string): TokenPayload | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) base64 += '='.repeat(4 - padding);
    return JSON.parse(atob(base64)) as TokenPayload;
  } catch {
    return null;
  }
}

// Mirrors lib/utils/session-hint.ts. The client only attempts a silent session
// restore when this readable flag is present; this middleware can see the real
// httpOnly refresh cookie, so it keeps the flag in step with it on every request.
// Without that, a browser holding a refresh cookie but no flag (e.g. a session
// from before the flag existed) would be let into the dashboard here yet never
// restore a session client-side — and /login would keep redirecting it back to /.
const HINT_COOKIE = 'miiday_admin_session';
const HINT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function withHint(response: NextResponse, request: NextRequest, present: boolean): NextResponse {
  const hasHint = request.cookies.has(HINT_COOKIE);
  if (present && !hasHint) {
    response.cookies.set(HINT_COOKIE, '1', {
      path: '/',
      sameSite: 'lax',
      maxAge: HINT_MAX_AGE_SECONDS,
      secure: request.nextUrl.protocol === 'https:',
      // Intentionally readable by scripts — it carries no secret.
      httpOnly: false,
    });
  } else if (!present && hasHint) {
    response.cookies.delete(HINT_COOKIE);
  }
  return response;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? readTokenPayload(token) : null;
  const role = payload?.role ?? null;
  const mustChangePassword = Boolean(payload?.mustChangePassword);
  const isAdmin = role !== null && ADMIN_ROLES.has(role);

  if (pathname === '/login') {
    if (isAdmin) {
      if (mustChangePassword) {
        return withHint(NextResponse.redirect(new URL('/change-password', request.url)), request, true);
      }
      return withHint(NextResponse.redirect(new URL('/', request.url)), request, true);
    }
    return withHint(NextResponse.next(), request, false);
  }

  if (!isAdmin) {
    return withHint(NextResponse.redirect(new URL('/login', request.url)), request, false);
  }

  if (mustChangePassword) {
    if (pathname !== '/change-password') {
      return withHint(NextResponse.redirect(new URL('/change-password', request.url)), request, true);
    }
    return withHint(NextResponse.next(), request, true);
  }

  if (pathname === '/change-password') {
    return withHint(NextResponse.redirect(new URL('/', request.url)), request, true);
  }

  return withHint(NextResponse.next(), request, true);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
