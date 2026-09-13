// Mirrors SAFE_URL_PATTERN in the API. The DTO is the authoritative check;
// this second gate keeps rows stored before that validation existed — or by a
// future path that bypasses it — from becoming a javascript:/data: URL in an
// href or src.
const SAFE_URL_PATTERN = /^(?:\/(?![/\\])[^\s]*|https?:\/\/[^\s]+)$/;

export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return SAFE_URL_PATTERN.test(value) ? value : null;
}
