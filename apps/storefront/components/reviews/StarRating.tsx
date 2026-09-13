'use client';

import { useState } from 'react';

const STARS = [1, 2, 3, 4, 5] as const;

function Star({ fill, className = '' }: { fill: number; className?: string }) {
  // `fill` is 0–1; a partial star is drawn by clipping a gold copy over a grey one.
  const clipId = `star-clip-${Math.round(fill * 100)}`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={24 * fill} height="24" />
        </clipPath>
      </defs>
      <path
        d="m12 2.6 2.95 6 6.55.95-4.75 4.6 1.15 6.55L12 17.6 6.1 20.7l1.15-6.55L2.5 9.55 9.05 8.6 12 2.6Z"
        className="fill-muted-border"
      />
      <path
        d="m12 2.6 2.95 6 6.55.95-4.75 4.6 1.15 6.55L12 17.6 6.1 20.7l1.15-6.55L2.5 9.55 9.05 8.6 12 2.6Z"
        className="fill-accent"
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
}

export function StarRating({
  rating,
  size = 'md',
  className = '',
}: {
  rating: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const starClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <span
      role="img"
      className={`inline-flex items-center gap-0.5 ${className}`}
      aria-label={`${rating.toFixed(1)} out of 5`}
    >
      {STARS.map((star) => (
        <Star key={star} fill={Math.max(0, Math.min(1, rating - (star - 1)))} className={starClass} />
      ))}
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)} role="radiogroup" aria-label="Rating">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          disabled={disabled}
          onMouseEnter={() => setHovered(star)}
          onClick={() => onChange(star)}
          className="rounded p-0.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed"
        >
          <Star fill={star <= shown ? 1 : 0} className="h-6 w-6" />
        </button>
      ))}
    </div>
  );
}
