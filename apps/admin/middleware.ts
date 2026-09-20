import { NextRequest, NextResponse } from 'next/server';

// Soft UX gate only — the backend guards are the real authorization boundary.
// It checks this app's own session hint, not the refresh cookie: in production
// that cookie belongs to the API's site and is never visible here. Role and
// mustChangePassword routing happen in AuthProvider.
const HINT_COOKIE = 'miiday_admin_session';
const PUBLIC_PATHS = new Set(['/login']);

export function middleware(request: NextRequest): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
