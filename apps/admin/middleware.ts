import { NextRequest, NextResponse } from 'next/server';

// Soft UX gate only — the backend RolesGuard and pending-password guard are the
// real authorization boundary.
//
// This deliberately does NOT read the refresh-token cookie. In production the
// API (Render) and this app (Vercel) are different sites, so that cookie belongs
// to the API's domain and is never visible here. Gating on it sent every
// protected page to /login even for a signed-in admin (the /login ⇄
// /change-password loop), and deleted the session hint as it went.
//
// Instead it checks the session hint this app sets on its own origin
// (lib/utils/session-hint.ts). Role and mustChangePassword routing happen in
// AuthProvider, which has the verified user from the API.
const HINT_COOKIE = 'miiday_admin_session';
const PUBLIC_PATHS = new Set(['/login']);

export function middleware(request: NextRequest): NextResponse {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!request.cookies.has(HINT_COOKIE)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
