'use client';

import { useEffect, useState } from 'react';
import type { AdminReviewView, ReviewStatus } from '@ecommerce/shared-types';
import { Badge, type BadgeTone } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api/client';
import { reviewsApi } from '../../../lib/api/reviews.api';

const PAGE_SIZE = 20;

const STATUS_FILTERS: { label: string; value: ReviewStatus | 'ALL' }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: 'ALL' },
];

const statusTone: Record<ReviewStatus, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="whitespace-nowrap text-sm text-accent" aria-label={`${rating} out of 5`}>
      {'★'.repeat(rating)}
      <span className="text-muted-border">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  const [items, setItems] = useState<AdminReviewView[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'ALL'>('PENDING');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await reviewsApi.list(
          page,
          PAGE_SIZE,
          statusFilter === 'ALL' ? undefined : statusFilter,
        );
        if (!cancelled) {
          setItems(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages || 1);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load reviews');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [page, statusFilter, reloadTick]);

  async function moderate(review: AdminReviewView, status: ReviewStatus) {
    setBusyId(review.id);
    setError('');
    try {
      await reviewsApi.moderate(review.id, status);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the review');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(review: AdminReviewView) {
    setBusyId(review.id);
    setError('');
    try {
      await reviewsApi.remove(review.id);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the review');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Reviews</h1>
        <p className="mt-1.5 text-xs text-text-secondary">
          {total} review{total === 1 ? '' : 's'} · only approved reviews appear on the storefront
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={`h-9 rounded border px-3.5 text-xs font-medium transition ${
              statusFilter === filter.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-text-secondary hover:border-primary/40 hover:text-text-primary'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <p className="rounded-lg border border-border bg-background px-4 py-10 text-center text-sm text-text-secondary">
          Loading reviews…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-border bg-background px-4 py-10 text-center text-sm text-text-secondary">
          Nothing to moderate here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((review) => (
            <li key={review.id} className="rounded-lg border border-border bg-background p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Stars rating={review.rating} />
                    <Badge tone={statusTone[review.status]}>{review.status}</Badge>
                    {review.isVerifiedPurchase ? <Badge tone="accent">Verified purchase</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm font-medium text-text-primary">{review.productName}</p>
                  <p className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary">
                    {review.authorName} · {review.authorEmail}
                  </p>
                </div>
                <span className="font-mono text-2xs text-text-secondary">
                  {new Date(review.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {review.title ? (
                <p className="mt-3 text-sm font-semibold text-text-primary">{review.title}</p>
              ) : null}
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-text-secondary">{review.body}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {review.status !== 'APPROVED' ? (
                  <Button
                    type="button"
                    className="h-9 px-3 text-xs"
                    disabled={busyId === review.id}
                    onClick={() => moderate(review, 'APPROVED')}
                  >
                    Approve
                  </Button>
                ) : null}
                {review.status !== 'REJECTED' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 px-3 text-xs"
                    disabled={busyId === review.id}
                    onClick={() => moderate(review, 'REJECTED')}
                  >
                    Reject
                  </Button>
                ) : null}
                {review.status !== 'PENDING' ? (
                  <button
                    type="button"
                    disabled={busyId === review.id}
                    onClick={() => moderate(review, 'PENDING')}
                    className="text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
                  >
                    Move back to pending
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyId === review.id}
                  onClick={() => remove(review)}
                  className="ml-auto text-xs text-danger hover:opacity-80 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-9 px-3 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
