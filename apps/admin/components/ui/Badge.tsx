import { ReactNode } from 'react';

export type BadgeTone = 'success' | 'danger' | 'warning' | 'neutral' | 'muted' | 'accent';

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  warning: 'bg-warning text-warning-foreground',
  neutral: 'bg-surface text-text-secondary',
  muted: 'border border-muted-border text-text-secondary',
  accent: 'bg-accent/15 text-accent',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-2xs font-medium uppercase tracking-wide ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
