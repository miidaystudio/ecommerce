'use client';

import { useState } from 'react';
import type { CouponView } from '@ecommerce/shared-types';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { ApiError } from '../../lib/api/client';
import { couponsApi, type CouponPayload } from '../../lib/api/coupons.api';
import { couponFormSchema, type CouponFormInput } from '../../lib/validators/coupon.schema';

// <input type="datetime-local"> needs a local "YYYY-MM-DDTHH:mm" value, while
// the API speaks ISO-8601 UTC.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function toFormState(coupon: CouponView | null): CouponFormInput {
  if (!coupon) {
    return {
      code: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: '',
      maxDiscount: '',
      minOrderValue: '',
      usageLimit: '',
      perUserLimit: '',
      isActive: true,
      startsAt: '',
      expiresAt: '',
    };
  }
  return {
    code: coupon.code,
    description: coupon.description ?? '',
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue),
    maxDiscount: coupon.maxDiscount === null ? '' : String(coupon.maxDiscount),
    minOrderValue: coupon.minOrderValue === null ? '' : String(coupon.minOrderValue),
    usageLimit: coupon.usageLimit === null ? '' : String(coupon.usageLimit),
    perUserLimit: coupon.perUserLimit === null ? '' : String(coupon.perUserLimit),
    isActive: coupon.isActive,
    startsAt: toLocalInputValue(coupon.startsAt),
    expiresAt: toLocalInputValue(coupon.expiresAt),
  };
}

interface CouponFormProps {
  coupon: CouponView | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function CouponForm({ coupon, onSaved, onCancel }: CouponFormProps) {
  const [form, setForm] = useState<CouponFormInput>(() => toFormState(coupon));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CouponFormInput>(key: K, value: CouponFormInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const parsed = couponFormSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const payload: CouponPayload = parsed.data;
    setSaving(true);
    try {
      if (coupon) {
        await couponsApi.update(coupon.id, payload);
      } else {
        await couponsApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the coupon');
    } finally {
      setSaving(false);
    }
  }

  const isPercentage = form.discountType === 'PERCENTAGE';

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-background p-5 shadow-card" noValidate>
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{coupon ? 'Edit coupon' : 'New coupon'}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="coupon-code"
          label="Code"
          value={form.code}
          onChange={(e) => set('code', e.target.value.toUpperCase())}
          placeholder="WELCOME10"
          className="font-mono uppercase tracking-wide"
          error={fieldErrors.code}
        />

        <Select
          id="coupon-type"
          label="Discount type"
          value={form.discountType}
          onChange={(e) => set('discountType', e.target.value as CouponFormInput['discountType'])}
          error={fieldErrors.discountType}
        >
          <option value="PERCENTAGE">Percentage off</option>
          <option value="FIXED">Fixed amount off</option>
        </Select>

        <FormField
          id="coupon-value"
          label={isPercentage ? 'Discount percentage' : 'Discount amount'}
          type="number"
          step={isPercentage ? '1' : '0.01'}
          min="0"
          value={form.discountValue}
          onChange={(e) => set('discountValue', e.target.value)}
          placeholder={isPercentage ? '10' : '250'}
          error={fieldErrors.discountValue}
        />

        <FormField
          id="coupon-max"
          label="Max discount (optional)"
          type="number"
          step="0.01"
          min="0"
          value={form.maxDiscount ?? ''}
          onChange={(e) => set('maxDiscount', e.target.value)}
          placeholder={isPercentage ? 'Caps a percentage discount' : ''}
          error={fieldErrors.maxDiscount}
        />

        <FormField
          id="coupon-min-order"
          label="Minimum order value (optional)"
          type="number"
          step="0.01"
          min="0"
          value={form.minOrderValue ?? ''}
          onChange={(e) => set('minOrderValue', e.target.value)}
          error={fieldErrors.minOrderValue}
        />

        <FormField
          id="coupon-usage-limit"
          label="Total redemptions allowed (optional)"
          type="number"
          step="1"
          min="1"
          value={form.usageLimit ?? ''}
          onChange={(e) => set('usageLimit', e.target.value)}
          placeholder="Unlimited"
          error={fieldErrors.usageLimit}
        />

        <FormField
          id="coupon-per-user-limit"
          label="Redemptions per customer (optional)"
          type="number"
          step="1"
          min="1"
          value={form.perUserLimit ?? ''}
          onChange={(e) => set('perUserLimit', e.target.value)}
          placeholder="Unlimited"
          error={fieldErrors.perUserLimit}
        />

        <FormField
          id="coupon-starts"
          label="Starts at (optional)"
          type="datetime-local"
          value={form.startsAt ?? ''}
          onChange={(e) => set('startsAt', e.target.value)}
          error={fieldErrors.startsAt}
        />

        <FormField
          id="coupon-expires"
          label="Expires at (optional)"
          type="datetime-local"
          value={form.expiresAt ?? ''}
          onChange={(e) => set('expiresAt', e.target.value)}
          error={fieldErrors.expiresAt}
        />

        <div className="sm:col-span-2">
          <Textarea
            id="coupon-description"
            label="Internal description (optional)"
            rows={2}
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            error={fieldErrors.description}
          />
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2.5 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        Active — customers can redeem this code
      </label>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-5 flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : coupon ? 'Save changes' : 'Create coupon'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
