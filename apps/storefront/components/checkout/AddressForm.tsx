'use client';

import { FormEvent, useState } from 'react';
import type { UserAddress } from '@ecommerce/shared-types';
import { Button } from '../ui/Button';
import { FormField } from '../ui/FormField';
import { ApiError } from '../../lib/api/client';
import { addressesApi, type AddressPayload } from '../../lib/api/addresses.api';

interface AddressFormProps {
  initial?: UserAddress;
  onSaved: (address: UserAddress) => void;
  onCancel?: () => void;
}

export function AddressForm({ initial, onSaved, onCancel }: AddressFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const payload: AddressPayload = {
      label: (form.get('label') as string) || undefined,
      fullName: form.get('fullName') as string,
      phone: form.get('phone') as string,
      line1: form.get('line1') as string,
      line2: (form.get('line2') as string) || undefined,
      city: form.get('city') as string,
      state: form.get('state') as string,
      postalCode: form.get('postalCode') as string,
      country: (form.get('country') as string) || undefined,
    };

    setSubmitting(true);
    try {
      const saved = initial
        ? await addressesApi.update(initial.id, payload)
        : await addressesApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this address');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Label (optional)" id="label" name="label" defaultValue={initial?.label ?? ''} placeholder="Home, Work…" />
        <FormField label="Full name" id="fullName" name="fullName" defaultValue={initial?.fullName} required />
      </div>
      <FormField label="Phone" id="phone" name="phone" type="tel" defaultValue={initial?.phone} required />
      <FormField label="Address line 1" id="line1" name="line1" defaultValue={initial?.line1} required />
      <FormField label="Address line 2 (optional)" id="line2" name="line2" defaultValue={initial?.line2 ?? ''} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="City" id="city" name="city" defaultValue={initial?.city} required />
        <FormField label="State" id="state" name="state" defaultValue={initial?.state} required />
        <FormField label="Postal code" id="postalCode" name="postalCode" defaultValue={initial?.postalCode} required />
      </div>
      <FormField label="Country" id="country" name="country" defaultValue={initial?.country ?? 'India'} />

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add address'}
        </Button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="text-sm text-text-secondary hover:text-text-primary">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
