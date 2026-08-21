import { NextRequest, NextResponse } from 'next/server';

const ADMIN_ROLES = new Set(['STAFF', 'SUPER_ADMIN']);
const COOKIE_NAME = process.env.REFRESH_COOKIE_NAME ?? 'refresh_token';

// Soft UX gate only. The backend RolesGuard is the real authorization boundary;
// the JWT signature is intentionally not verified here (no secret on the edge).
function readRole(token: string): string | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4;
    if (padding) base64 += '='.repeat(4 - padding);
    const payload = JSON.parse(atob(base64)) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const role = token ? readRole(token) : null;
  const isAdmin = role !== null && ADMIN_ROLES.has(role);

  if (pathname === '/login') {
    return isAdmin ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }

  if (!isAdmin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
