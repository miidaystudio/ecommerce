'use client';

import { useEffect, useState } from 'react';
import type { BannerView } from '@ecommerce/shared-types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { ApiError } from '../../../lib/api/client';
import { bannersApi, type BannerPayload } from '../../../lib/api/banners.api';
import { bannerFormSchema, type BannerFormInput } from '../../../lib/validators/coupon.schema';
import { resolveImageUrl } from '../../../lib/utils/image-url';

function toFormState(banner: BannerView | null): BannerFormInput {
  if (!banner) {
    return { title: '', subtitle: '', imageUrl: '', linkUrl: '', position: '0', isActive: true };
  }
  return {
    title: banner.title,
    subtitle: banner.subtitle ?? '',
    imageUrl: banner.imageUrl ?? '',
    linkUrl: banner.linkUrl ?? '',
    position: String(banner.position),
    isActive: banner.isActive,
  };
}

export default function BannersPage() {
  const [items, setItems] = useState<BannerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BannerView | null>(null);
  const [form, setForm] = useState<BannerFormInput>(() => toFormState(null));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await bannersApi.list();
        if (!cancelled) setItems(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load banners');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  function set<K extends keyof BannerFormInput>(key: K, value: BannerFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setEditing(null);
    setForm(toFormState(null));
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(banner: BannerView) {
    setEditing(banner);
    setForm(toFormState(banner));
    setFieldErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const parsed = bannerFormSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const payload: BannerPayload = parsed.data;
    setSaving(true);
    try {
      if (editing) {
        await bannersApi.update(editing.id, payload);
      } else {
        await bannersApi.create(payload);
      }
      setFormOpen(false);
      setEditing(null);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the banner');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(banner: BannerView) {
    setBusyId(banner.id);
    setError('');
    try {
      await bannersApi.update(banner.id, { isActive: !banner.isActive });
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the banner');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(banner: BannerView) {
    setBusyId(banner.id);
    setError('');
    try {
      await bannersApi.remove(banner.id);
      setReloadTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the banner');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Homepage banners</h1>
          <p className="mt-1.5 text-xs text-text-secondary">
            {items.length} banner{items.length === 1 ? '' : 's'} · lowest position shows first on the storefront
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          New banner
        </Button>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {formOpen ? (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border border-border bg-background p-5 shadow-card"
          noValidate
        >
          <h2 className="mb-4 text-lg font-semibold text-text-primary">{editing ? 'Edit banner' : 'New banner'}</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="banner-title"
              label="Title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Autumn edit"
              error={fieldErrors.title}
            />
            <FormField
              id="banner-subtitle"
              label="Subtitle (optional)"
              value={form.subtitle ?? ''}
              onChange={(e) => set('subtitle', e.target.value)}
              placeholder="New arrivals in warm neutrals"
              error={fieldErrors.subtitle}
            />
            <FormField
              id="banner-image"
              label="Image URL (optional)"
              value={form.imageUrl ?? ''}
              onChange={(e) => set('imageUrl', e.target.value)}
              placeholder="/uploads/products/…"
              error={fieldErrors.imageUrl}
            />
            <FormField
              id="banner-link"
              label="Link URL (optional)"
              value={form.linkUrl ?? ''}
              onChange={(e) => set('linkUrl', e.target.value)}
              placeholder="/products?category=outerwear"
              error={fieldErrors.linkUrl}
            />
            <FormField
              id="banner-position"
              label="Position"
              type="number"
              step="1"
              min="0"
              value={form.position ?? ''}
              onChange={(e) => set('position', e.target.value)}
              error={fieldErrors.position}
            />
          </div>

          <label className="mt-4 flex items-center gap-2.5 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Active — show this banner on the storefront
          </label>

          <div className="mt-5 flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create banner'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="rounded-lg border border-border bg-background px-4 py-10 text-center text-sm text-text-secondary">
          Loading banners…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-border bg-background px-4 py-10 text-center text-sm text-text-secondary">
          No banners yet. Create one to feature it on the homepage.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((banner) => (
            <li
              key={banner.id}
              className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-background p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface font-mono text-xs text-text-secondary">
                {banner.position}
              </span>

              {banner.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveImageUrl(banner.imageUrl)}
                  alt=""
                  className="h-14 w-24 shrink-0 rounded border border-border object-cover"
                />
              ) : (
                <span className="flex h-14 w-24 shrink-0 items-center justify-center rounded border border-dashed border-border font-mono text-2xs text-text-secondary">
                  No image
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">{banner.title}</p>
                  <Badge tone={banner.isActive ? 'success' : 'muted'}>{banner.isActive ? 'Active' : 'Hidden'}</Badge>
                </div>
                {banner.subtitle ? <p className="mt-0.5 text-xs text-text-secondary">{banner.subtitle}</p> : null}
                {banner.linkUrl ? (
                  <p className="mt-0.5 truncate font-mono text-2xs text-text-secondary">{banner.linkUrl}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openEdit(banner)}
                  className="text-xs font-medium text-primary hover:text-primary-hover"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busyId === banner.id}
                  onClick={() => toggleActive(banner)}
                  className="text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  {banner.isActive ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  disabled={busyId === banner.id}
                  onClick={() => remove(banner)}
                  className="text-xs text-danger hover:opacity-80 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
