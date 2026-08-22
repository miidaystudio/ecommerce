const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

// Product image URLs come back from the API as paths relative to its own origin
// (e.g. "/uploads/products/{id}/{file}.png"), not the "/api" prefix used for JSON routes.
export function resolveImageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${API_ORIGIN}${path}`;
}
