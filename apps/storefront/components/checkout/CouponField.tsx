'use client';

import { useState } from 'react';
import type { AppliedCoupon } from '@ecommerce/shared-types';
import { ApiError } from '../../lib/api/client';
import { couponsApi } from '../../lib/api/coupons.api';
import { formatPrice } from '../../lib/utils/format-price';

interface CouponFieldProps {
  applied: AppliedCoupon | null;
  onApplied: (coupon: AppliedCoupon | null) => void;
  disabled?: boolean;
}

export function CouponField({ applied, onApplied, disabled }: CouponFieldProps) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  async function handleApply(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a coupon code.');
      return;
    }
    setError('');
    setChecking(true);
    try {
      // The preview is display-only — the order endpoint validates the code again.
      const result = await couponsApi.preview(trimmed);
      onApplied(result);
      setCode('');
    } catch (err) {
      onApplied(null);
      setError(err instanceof ApiError ? err.message : "That code couldn't be applied.");
    } finally {
      setChecking(false);
    }
  }

  function handleRemove() {
    onApplied(null);
    setError('');
  }

  if (applied) {
    return (
      <div className="mt-4 rounded border border-success/30 bg-success/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.1em] text-success-strong">Coupon applied</p>
            <p className="mt-0.5 text-sm font-semibold text-text-primary">{applied.code}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-success-strong">−{formatPrice(applied.discount)}</p>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="text-2xs text-success-strong underline hover:text-text-primary disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleApply} className="mt-4" noValidate>
      <label htmlFor="coupon-code" className="font-mono text-2xs uppercase tracking-[0.1em] text-text-secondary">
        Coupon code
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code"
          autoComplete="off"
          disabled={disabled || checking}
          className={`h-10 min-w-0 flex-1 rounded border bg-background px-3 font-mono text-sm uppercase tracking-wide text-text-primary outline-none transition focus:border-primary disabled:opacity-60 ${
            error ? 'border-danger' : 'border-border'
          }`}
        />
        <button
          type="submit"
          disabled={disabled || checking}
          className="h-10 shrink-0 rounded border border-border px-3.5 text-xs font-medium text-primary transition hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Apply'}
        </button>
      </div>
      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
    </form>
  );
}
