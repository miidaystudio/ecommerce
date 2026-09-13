import type { ReactNode } from 'react';

/**
 * Shared shell for the info and policy pages: mono eyebrow, page title, and a
 * measured prose column, matching the type hierarchy in design.md.
 */
export function InfoPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <article>
      <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">{eyebrow}</span>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{title}</h1>
      {intro ? <p className="mt-4 text-md leading-relaxed text-text-secondary">{intro}</p> : null}
      {updated ? (
        <p className="mt-2 font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary">
          Last updated {updated}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-8">{children}</div>
    </article>
  );
}

export function InfoSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary">{heading}</h2>
      <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

/**
 * Marks copy the client still has to approve.
 *
 * The legal pages below are drafted structurally, not authoritatively — a
 * developer inventing binding terms or a privacy declaration on a client's
 * behalf would be worse than an obvious placeholder.
 */
export function DraftNotice({ children }: { children: ReactNode }) {
  return (
    <aside className="rounded-lg border border-warning bg-warning/20 p-4">
      <p className="font-mono text-2xs uppercase tracking-[0.1em] text-warning-foreground">Needs client review</p>
      <p className="mt-1.5 text-sm leading-relaxed text-warning-foreground">{children}</p>
    </aside>
  );
}
