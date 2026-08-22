import Link from 'next/link';
import { buildQueryString } from '../../lib/utils/query-string';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  currentParams: Record<string, string | undefined>;
}

// Builds a compact page-number window (first, last, and a range around current) so very
// long result sets don't render hundreds of page links.
function getPageWindow(current: number, total: number, delta = 2): (number | 'ellipsis')[] {
  const window: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - delta);
  const end = Math.min(total - 1, current + delta);

  if (start > 2) window.push('ellipsis');
  for (let page = start; page <= end; page += 1) {
    window.push(page);
  }
  if (end < total - 1) window.push('ellipsis');
  if (total > 1) window.push(total);

  return window;
}

export function Pagination({ currentPage, totalPages, currentParams }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pageWindow = getPageWindow(currentPage, totalPages);
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
      <Link
        href={`/products${buildQueryString(currentParams, { page: String(Math.max(1, currentPage - 1)) })}`}
        aria-disabled={prevDisabled}
        tabIndex={prevDisabled ? -1 : undefined}
        className={`rounded border border-border px-3 py-1.5 text-sm transition ${
          prevDisabled
            ? 'pointer-events-none text-muted-border'
            : 'text-text-primary hover:border-primary/40'
        }`}
      >
        Prev
      </Link>

      {pageWindow.map((entry, index) =>
        entry === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-1 text-sm text-text-secondary">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={`/products${buildQueryString(currentParams, { page: String(entry) })}`}
            aria-current={entry === currentPage ? 'page' : undefined}
            className={`rounded px-3 py-1.5 text-sm transition ${
              entry === currentPage
                ? 'bg-primary text-primary-foreground'
                : 'text-text-primary hover:bg-surface'
            }`}
          >
            {entry}
          </Link>
        ),
      )}

      <Link
        href={`/products${buildQueryString(currentParams, { page: String(Math.min(totalPages, currentPage + 1)) })}`}
        aria-disabled={nextDisabled}
        tabIndex={nextDisabled ? -1 : undefined}
        className={`rounded border border-border px-3 py-1.5 text-sm transition ${
          nextDisabled
            ? 'pointer-events-none text-muted-border'
            : 'text-text-primary hover:border-primary/40'
        }`}
      >
        Next
      </Link>
    </nav>
  );
}
