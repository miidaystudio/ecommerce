'use client';

import { useEffect, useState } from 'react';
import type { StoreSettingsView } from '@ecommerce/shared-types';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Textarea } from '../../../components/ui/Textarea';
import { ApiError } from '../../../lib/api/client';
import { settingsApi, type SettingsPayload } from '../../../lib/api/settings.api';
import { useAuth } from '../../../lib/hooks/useAuth';
import { settingsFormSchema, type SettingsFormInput } from '../../../lib/validators/settings.schema';

function toFormState(settings: StoreSettingsView): SettingsFormInput {
  return {
    storeName: settings.storeName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone ?? '',
    addressLine: settings.addressLine ?? '',
    freeShippingThreshold: String(settings.freeShippingThreshold),
    flatShippingFee: String(settings.flatShippingFee),
    taxRatePercent: String(settings.taxRatePercent),
    lowStockThreshold: String(settings.lowStockThreshold),
    ordersEnabled: settings.ordersEnabled,
    maintenanceNotice: settings.maintenanceNotice ?? '',
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'SUPER_ADMIN';

  const [form, setForm] = useState<SettingsFormInput | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const settings = await settingsApi.get();
        if (!cancelled) setForm(toFormState(settings));
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof SettingsFormInput>(key: K, value: SettingsFormInput[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError('');
    setSaved('');

    const parsed = settingsFormSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const payload: SettingsPayload = parsed.data;
    setSaving(true);
    try {
      const updated = await settingsApi.update(payload);
      setForm(toFormState(updated));
      setSaved('Settings saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="rounded-lg border border-border bg-background px-4 py-10 text-center text-sm text-text-secondary">
        Loading settings…
      </p>
    );
  }

  if (!form) {
    return <p className="text-sm text-danger">{error || 'Settings are unavailable.'}</p>;
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Store settings</h1>
        <p className="mt-1.5 text-xs text-text-secondary">
          Shipping thresholds and the low-stock level used across the admin and storefront.
        </p>
      </div>

      {/* The API enforces this too — RolesGuard rejects a STAFF PATCH with 403.
          This only keeps a staff member from filling in a form that cannot save. */}
      {!canEdit ? (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary">
          These settings are read-only for staff accounts. Ask a super admin to make changes.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <fieldset disabled={!canEdit || saving} className="contents">
          <section className="rounded-lg border border-border bg-background p-5">
            <h2 className="mb-4 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Store identity
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="store-name"
                label="Store name"
                value={form.storeName}
                onChange={(e) => set('storeName', e.target.value)}
                error={fieldErrors.storeName}
              />
              <FormField
                id="support-email"
                label="Support email"
                type="email"
                value={form.supportEmail}
                onChange={(e) => set('supportEmail', e.target.value)}
                error={fieldErrors.supportEmail}
              />
              <FormField
                id="support-phone"
                label="Support phone (optional)"
                value={form.supportPhone ?? ''}
                onChange={(e) => set('supportPhone', e.target.value)}
                error={fieldErrors.supportPhone}
              />
              <FormField
                id="address-line"
                label="Address (optional)"
                value={form.addressLine ?? ''}
                onChange={(e) => set('addressLine', e.target.value)}
                error={fieldErrors.addressLine}
              />
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-border bg-background p-5">
            <h2 className="mb-4 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Shipping &amp; tax
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="free-shipping"
                label="Free shipping above (₹)"
                type="number"
                step="0.01"
                min="0"
                value={form.freeShippingThreshold}
                onChange={(e) => set('freeShippingThreshold', e.target.value)}
                error={fieldErrors.freeShippingThreshold}
              />
              <FormField
                id="flat-shipping"
                label="Flat shipping fee (₹)"
                type="number"
                step="0.01"
                min="0"
                value={form.flatShippingFee}
                onChange={(e) => set('flatShippingFee', e.target.value)}
                error={fieldErrors.flatShippingFee}
              />
              <FormField
                id="tax-rate"
                label="Tax rate (%)"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.taxRatePercent}
                onChange={(e) => set('taxRatePercent', e.target.value)}
                error={fieldErrors.taxRatePercent}
              />
              <FormField
                id="low-stock"
                label="Low stock threshold"
                type="number"
                step="1"
                min="0"
                value={form.lowStockThreshold}
                onChange={(e) => set('lowStockThreshold', e.target.value)}
                error={fieldErrors.lowStockThreshold}
              />
            </div>
            <p className="mt-3 text-2xs text-text-secondary">
              Prices are tax-inclusive. This rate is used to show the GST contained in each total — on the cart,
              checkout, order confirmation, admin order detail and invoice — and is never added on top. Each order
              keeps the rate in force when it was placed.
            </p>
          </section>

          <section className="mt-5 rounded-lg border border-border bg-background p-5">
            <h2 className="mb-4 font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
              Order availability
            </h2>

            <label className="flex items-start gap-2.5 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={form.ordersEnabled}
                onChange={(e) => set('ordersEnabled', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <span>
                Accepting orders
                <span className="mt-0.5 block text-xs text-text-secondary">
                  Unchecking this rejects new orders at the API, not just in the storefront UI. Browsing stays open.
                </span>
              </span>
            </label>

            <div className="mt-4">
              <Textarea
                id="maintenance-notice"
                label="Message shown when orders are closed (optional)"
                rows={2}
                value={form.maintenanceNotice ?? ''}
                onChange={(e) => set('maintenanceNotice', e.target.value)}
                error={fieldErrors.maintenanceNotice}
              />
            </div>
          </section>

          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
          {saved ? <p className="mt-4 text-sm text-success">{saved}</p> : null}

          {canEdit ? (
            <div className="mt-5">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          ) : null}
        </fieldset>
      </form>
    </div>
  );
}
