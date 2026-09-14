import type { SessionResponse } from '@ecommerce/shared-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

let accessTokenProvider: () => string | null = () => null;

export function setAccessTokenProvider(fn: () => string | null): void {
  accessTokenProvider = fn;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return fallback;
}

export interface SessionHandlers {
  onRefreshed: (session: SessionResponse) => void;
  onExpired: () => void;
}

const REFRESH_LOCK = 'miiday-session-refresh';
const MAX_REFRESH_LEAD_MS = 60_000;
const REFRESH_RETRY_DELAY_MS = 1_500;

let sessionHandlers: SessionHandlers | null = null;
let refreshInFlight: Promise<SessionResponse | null> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshDueAt: number | null = null;

export function setSessionHandlers(handlers: SessionHandlers): void {
  const firstRegistration = sessionHandlers === null;
  sessionHandlers = handlers;
  // Timers in background tabs are throttled and don't run while the device
  // sleeps, so a tab coming back checks whether its refresh is overdue.
  if (firstRegistration && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && refreshDueAt !== null && Date.now() >= refreshDueAt) {
        void refreshSession().catch(() => undefined);
      }
    });
  }
}

function postRefresh(): Promise<Response> {
  return fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
}

async function runRefresh(): Promise<SessionResponse | null> {
  let response = await postRefresh();
  // Refresh tokens are single-use. A 401 here can mean another tab, or the
  // other app sharing this API's cookie, rotated the token a moment earlier;
  // its replacement is in the cookie jar by the time this retries.
  if (response.status === 401) {
    await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY_MS));
    response = await postRefresh();
  }
  if (response.status === 401) {
    scheduleSessionRefresh(null);
    sessionHandlers?.onExpired();
    return null;
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, 'Could not restore your session'));
  }
  const session = payload as SessionResponse;
  sessionHandlers?.onRefreshed(session);
  return session;
}

function withRefreshLock(task: () => Promise<SessionResponse | null>): Promise<SessionResponse | null> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return task();
  // The lock is held until the task settles.
  return new Promise((resolve, reject) => {
    locks.request(REFRESH_LOCK, () => task().then(resolve, reject)).catch(reject);
  });
}

/**
 * Exchanges the refresh cookie for a new access token. Resolves to null when
 * the session is gone (after notifying onExpired) and throws on transient
 * failures. Concurrent callers share one request, and tabs take turns, because
 * two overlapping refreshes would present the same single-use token.
 */
export function refreshSession(): Promise<SessionResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = withRefreshLock(runRefresh).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function tokenLifetimeMs(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp, iat } = JSON.parse(atob(payload)) as { exp?: number; iat?: number };
    return exp && iat ? (exp - iat) * 1000 : null;
  } catch {
    return null;
  }
}

/** Renews the access token shortly before it expires. Measured from now rather
 * than from `exp`, so a wrong clock on the device can't shift it. */
export function scheduleSessionRefresh(accessToken: string | null): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  refreshDueAt = null;
  if (!accessToken || typeof window === 'undefined') return;

  const lifetime = tokenLifetimeMs(accessToken);
  if (!lifetime) return;
  const delay = lifetime - Math.min(MAX_REFRESH_LEAD_MS, lifetime / 4);
  refreshDueAt = Date.now() + delay;
  refreshTimer = setTimeout(() => {
    void refreshSession().catch(() => undefined);
  }, delay);
}

async function send(path: string, init: RequestInit, auth: boolean): Promise<Response> {
  let sentToken = false;
  const build = (): RequestInit => {
    const headers = new Headers(init.headers);
    const token = auth ? accessTokenProvider() : null;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    sentToken = Boolean(token);
    return { ...init, headers, credentials: 'include' };
  };

  const response = await fetch(`${API_URL}${path}`, build());
  if (response.status !== 401 || !sentToken) return response;

  // Backstop for a missed proactive refresh (e.g. the device slept): renew once
  // and replay the request with the new token. A request sent without a token
  // (a logged-out visitor) has no session to renew.
  const session = await refreshSession().catch(() => null);
  return session ? fetch(`${API_URL}${path}`, build()) : response;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await send(
    path,
    { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined },
    auth,
  );

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, 'Request failed'));
  }

  return payload as T;
}
