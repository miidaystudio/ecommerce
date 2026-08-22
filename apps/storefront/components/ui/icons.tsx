interface IconProps {
  className?: string;
}

interface HeartIconProps extends IconProps {
  filled?: boolean;
}

export function HeartIcon({ className = 'h-5 w-5', filled = false }: HeartIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20.25c-.3 0-.6-.1-.83-.28C7.9 17.6 3 13.66 3 9.3 3 6.6 5.1 4.5 7.7 4.5c1.5 0 2.9.72 3.8 1.9.9-1.18 2.3-1.9 3.8-1.9 2.6 0 4.7 2.1 4.7 4.8 0 4.36-4.9 8.3-8.17 10.67-.23.18-.53.28-.83.28Z"
      />
    </svg>
  );
}

export function CartIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L20 8H6" />
      <circle cx="10" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
