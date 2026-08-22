// Merges the current PLP filter params with overrides and serializes to a query string.
// Used by both the server-rendered pagination links and the client filter/sort controls so
// the URL always stays the single source of truth for filter state (shareable/bookmarkable).
export function buildQueryString(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {},
): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== '') {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
