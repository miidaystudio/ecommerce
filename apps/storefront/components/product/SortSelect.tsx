'use client';

import { usePathname, useRouter } from 'next/navigation';
import { buildQueryString } from '../../lib/utils/query-string';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export function SortSelect({ currentParams }: { currentParams: Record<string, string | undefined> }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={currentParams.sort ?? 'newest'}
      onChange={(event) =>
        router.push(`${pathname}${buildQueryString(currentParams, { sort: event.target.value })}`)
      }
      aria-label="Sort products"
      className="h-9 rounded border border-border bg-background px-2.5 text-sm text-text-primary outline-none focus:border-primary"
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
