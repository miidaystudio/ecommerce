'use client';

import { useAuth } from '../../lib/hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.firstName || user?.email?.split('@')[0] || 'there';

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Good day, {firstName}
          </h1>
          <p className="mt-1.5 text-xs text-text-secondary">
            Here&apos;s what&apos;s happening in your store today.
          </p>
        </div>
      </div>

      <span className="mb-6 inline-block w-fit rounded-full bg-surface px-3 py-1 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
        Phase 2 · Product catalog data arrives next
      </span>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Revenue', value: '—', note: 'Connects once orders exist' },
          { label: 'Orders', value: '—', note: 'Connects once orders exist' },
          { label: 'New customers', value: '—', note: 'Connects once customers exist' },
          { label: 'Avg. order value', value: '—', note: 'Connects once orders exist' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg bg-surface p-5">
            <span className="text-xs text-text-secondary">{stat.label}</span>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{stat.value}</div>
            <div className="mt-1 text-xs text-text-secondary">{stat.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
