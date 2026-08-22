// Simple client-side slug derivation used to pre-fill the slug field from a
// product/category name. The API independently derives its own slug when
// none is supplied, so this only needs to be "good enough" for editing.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
