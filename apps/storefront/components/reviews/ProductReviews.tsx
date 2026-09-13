'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PaginatedReviews, ProductReviewSummary, ReviewView } from '@ecommerce/shared-types';
import { StarRating, StarRatingInput } from './StarRating';
import { Button } from '../ui/Button';
import { ApiError } from '../../lib/api/client';
import { reviewsApi } from '../../lib/api/reviews.api';
import { useAuth } from '../../lib/hooks/useAuth';
import { reviewFormSchema, type ReviewFormInput } from '../../lib/validators/review.schema';

const PAGE_SIZE = 5;
const STARS = [5, 4, 3, 2, 1] as const;

const EMPTY_FORM: ReviewFormInput = { rating: 0, title: '', body: '' };

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ProductReviews({ productId, productSlug }: { productId: string; productSlug: string }) {
  const { status } = useAuth();

  const [summary, setSummary] = useState<ProductReviewSummary | null>(null);
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState<PaginatedReviews<ReviewView> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [mine, setMine] = useState<ReviewView | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ReviewFormInput>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const [summaryResult, listResult] = await Promise.all([
          reviewsApi.summary(productId),
          reviewsApi.listForProduct(productId, page, PAGE_SIZE),
        ]);
        if (!cancelled) {
          setSummary(summaryResult);
          setReviews(listResult);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Could not load reviews.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [productId, page, reloadTick]);

  useEffect(() => {
    if (status !== 'authenticated') {
      setMine(null);
      return;
    }
    let cancelled = false;
    async function loadMine() {
      try {
        const result = await reviewsApi.getMine(productId);
        if (!cancelled) setMine(result);
      } catch {
        // A missing own-review isn't an error worth surfacing on the PDP.
        if (!cancelled) setMine(null);
      }
    }
    loadMine();
    return () => {
      cancelled = true;
    };
  }, [productId, status, reloadTick]);

  function openForm() {
    setForm(
      mine ? { rating: mine.rating, title: mine.title ?? '', body: mine.body } : EMPTY_FORM,
    );
    setFieldErrors({});
    setSaveError('');
    setNotice('');
    setFormOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaveError('');

    const parsed = reviewFormSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      await reviewsApi.upsertMine(productId, parsed.data);
      setFormOpen(false);
      setNotice('Thanks — your review is with our team and will appear once approved.');
      setReloadTick((t) => t + 1);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not save your review.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setSaveError('');
    try {
      await reviewsApi.removeMine(productId);
      setMine(null);
      setFormOpen(false);
      setNotice('Your review was removed.');
      setReloadTick((t) => t + 1);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Could not remove your review.');
    } finally {
      setSaving(false);
    }
  }

  const ratingCount = summary?.ratingCount ?? 0;
  const totalPages = reviews?.totalPages ?? 1;

  return (
    <section className="border-t border-border pt-10">
      <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">Reviews</span>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">Ratings &amp; reviews</h2>

      {loadError ? <p className="mt-4 text-sm text-danger">{loadError}</p> : null}

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[280px_1fr]">
        <div>
          {ratingCount > 0 && summary ? (
            <>
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-semibold text-text-primary">{summary.ratingAverage.toFixed(1)}</span>
                <StarRating rating={summary.ratingAverage} />
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                Based on {ratingCount} review{ratingCount === 1 ? '' : 's'}
              </p>

              <ul className="mt-4 flex flex-col gap-1.5">
                {STARS.map((star) => {
                  const count = summary.breakdown[star] ?? 0;
                  const pct = ratingCount > 0 ? Math.round((count / ratingCount) * 100) : 0;
                  return (
                    <li key={star} className="flex items-center gap-2.5 text-xs text-text-secondary">
                      <span className="w-8 shrink-0 font-mono">{star}★</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-7 shrink-0 text-right font-mono">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-text-secondary">No reviews yet — be the first to share your thoughts.</p>
          )}

          <div className="mt-6">
            {status === 'authenticated' ? (
              !formOpen ? (
                <Button type="button" variant="secondary" onClick={openForm} className="w-full">
                  {mine ? 'Edit your review' : 'Write a review'}
                </Button>
              ) : null
            ) : (
              <Link
                href={`/login?next=/products/${productSlug}`}
                className="text-sm font-medium text-primary hover:text-primary-hover"
              >
                Sign in to write a review
              </Link>
            )}
          </div>

          {notice ? <p className="mt-3 text-xs text-success">{notice}</p> : null}

          {mine && !formOpen ? (
            <div className="mt-4 rounded border border-border bg-surface p-3">
              <p className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary">Your review</p>
              <div className="mt-1.5 flex items-center gap-2">
                <StarRating rating={mine.rating} size="sm" />
                <span className="text-2xs text-text-secondary">
                  {mine.status === 'APPROVED'
                    ? 'Published'
                    : mine.status === 'PENDING'
                      ? 'Awaiting approval'
                      : 'Not published'}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          {formOpen ? (
            <form onSubmit={handleSubmit} className="mb-8 rounded-lg border border-border bg-surface p-5" noValidate>
              <h3 className="text-sm font-medium text-text-primary">{mine ? 'Edit your review' : 'Write a review'}</h3>

              <div className="mt-4">
                <span className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary">Your rating</span>
                <div className="mt-1.5">
                  <StarRatingInput
                    value={form.rating}
                    onChange={(rating) => setForm((prev) => ({ ...prev, rating }))}
                    disabled={saving}
                  />
                </div>
                {fieldErrors.rating ? <p className="mt-1 text-xs text-danger">{fieldErrors.rating}</p> : null}
              </div>

              <div className="mt-4">
                <label
                  htmlFor="review-title"
                  className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary"
                >
                  Headline (optional)
                </label>
                <input
                  id="review-title"
                  value={form.title ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  disabled={saving}
                  className={`mt-1.5 h-11 w-full rounded border bg-background px-3.5 text-base text-text-primary outline-none transition focus:border-primary ${
                    fieldErrors.title ? 'border-danger' : 'border-border'
                  }`}
                />
                {fieldErrors.title ? <p className="mt-1 text-xs text-danger">{fieldErrors.title}</p> : null}
              </div>

              <div className="mt-4">
                <label
                  htmlFor="review-body"
                  className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary"
                >
                  Your review
                </label>
                <textarea
                  id="review-body"
                  rows={5}
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                  disabled={saving}
                  className={`mt-1.5 w-full rounded border bg-background px-3.5 py-2.5 text-base leading-relaxed text-text-primary outline-none transition focus:border-primary ${
                    fieldErrors.body ? 'border-danger' : 'border-border'
                  }`}
                />
                {fieldErrors.body ? <p className="mt-1 text-xs text-danger">{fieldErrors.body}</p> : null}
              </div>

              <p className="mt-3 text-2xs text-text-secondary">
                Reviews are checked by our team before they appear on the site.
              </p>
              {saveError ? <p className="mt-2 text-xs text-danger">{saveError}</p> : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : mine ? 'Update review' : 'Submit review'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                {mine ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="ml-auto text-xs text-danger hover:opacity-80 disabled:opacity-50"
                  >
                    Delete review
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}

          {loading ? (
            <p className="text-sm text-text-secondary">Loading reviews…</p>
          ) : !reviews || reviews.items.length === 0 ? (
            <p className="text-sm text-text-secondary">There are no published reviews for this product yet.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-6">
                {reviews.items.map((review) => (
                  <li key={review.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <StarRating rating={review.rating} size="sm" />
                      <span className="text-sm font-medium text-text-primary">{review.authorName}</span>
                      {review.isVerifiedPurchase ? (
                        <span className="rounded-full bg-success/15 px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.1em] text-success-strong">
                          Verified purchase
                        </span>
                      ) : null}
                      <span className="ml-auto font-mono text-2xs text-text-secondary">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    {review.title ? (
                      <p className="mt-2 text-sm font-semibold text-text-primary">{review.title}</p>
                    ) : null}
                    <p className="mt-1.5 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                      {review.body}
                    </p>
                  </li>
                ))}
              </ul>

              {totalPages > 1 ? (
                <div className="mt-6 flex items-center justify-between text-sm text-text-secondary">
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
            </>
          )}
        </div>
      </div>
    </section>
  );
}
