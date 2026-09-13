// A non-secret "this browser has a session" flag, readable by page scripts.
//
// The real credential is the refresh token, which lives in an httpOnly cookie
// precisely so scripts cannot see it — but that also means the app cannot tell
// whether one exists. Without this flag, every page load for a logged-out
// visitor fired POST /auth/refresh and logged a 401 to the console.
//
// This flag is only a hint about whether to *try* restoring the session. It
// grants nothing: /auth/refresh still requires the httpOnly cookie, and every
// protected API route still validates the access token server-side. A forged
// flag just produces the failed refresh it was avoiding; a deleted one just
// shows that browser as logged out until the next sign-in.
//
// It is set by the storefront itself, on its own origin, rather than by the
// API: in production the API is on a different host, and a cookie it set would
// not be readable from this app's scripts.
const HINT_COOKIE = 'miiday_session';

// Matches the default refresh-token lifetime (JWT_REFRESH_TTL=7d). It is renewed
// on every successful restore, as the refresh token itself is rotated; if the
// two drift, the only effect is one failed restore, which clears the flag.
const HINT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

export function hasSessionHint(): boolean {
  if (!isBrowser()) return false;
  return document.cookie.split(';').some((part) => part.trim().startsWith(`${HINT_COOKIE}=`));
}

export function setSessionHint(): void {
  if (!isBrowser()) return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${HINT_COOKIE}=1; Max-Age=${HINT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function clearSessionHint(): void {
  if (!isBrowser()) return;
  document.cookie = `${HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
