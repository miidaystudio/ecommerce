const STORAGE_KEY = 'miiday.recentlyViewed';
const MAX_TRACKED = 12;

// Browsing history is a per-device convenience, so it lives in localStorage
// rather than on the account. Reads/writes are guarded: storage can be
// unavailable (private mode, blocked site data) or hold junk from an older build.
export function readRecentlyViewed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_TRACKED);
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(productId: string): string[] {
  const previous = readRecentlyViewed().filter((id) => id !== productId);
  const next = [productId, ...previous].slice(0, MAX_TRACKED);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Nothing to recover from — the feature degrades to "no history".
    }
  }
  return next;
}
