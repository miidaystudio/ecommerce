'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { UserAddress } from '@ecommerce/shared-types';
import { AddressForm } from '../../../../components/checkout/AddressForm';
import { Button } from '../../../../components/ui/Button';
import { ApiError } from '../../../../lib/api/client';
import { addressesApi } from '../../../../lib/api/addresses.api';
import { useAuth } from '../../../../lib/hooks/useAuth';

export default function AddressesPage() {
  const router = useRouter();
  const { status } = useAuth();

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const list = await addressesApi.list();
        if (!cancelled) setAddresses(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load addresses');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [status]);

  function handleSaved(address: UserAddress) {
    setAddresses((prev) => {
      const exists = prev.some((a) => a.id === address.id);
      const next = exists ? prev.map((a) => (a.id === address.id ? address : a)) : [...prev, address];
      return address.isDefault ? next.map((a) => (a.id === address.id ? a : { ...a, isDefault: false })) : next;
    });
    setShowAddForm(false);
    setEditingId(null);
  }

  async function handleSetDefault(id: string) {
    setBusyId(id);
    try {
      await addressesApi.setDefault(id);
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set default address');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this address?')) return;
    setBusyId(id);
    try {
      await addressesApi.remove(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this address');
    } finally {
      setBusyId(null);
    }
  }

  if (status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-text-secondary">Loading…</p>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <span className="font-mono text-2xs uppercase tracking-[0.15em] text-accent">Account</span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Addresses</h1>
        </div>
        {!showAddForm ? <Button onClick={() => setShowAddForm(true)}>+ Add address</Button> : null}
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {showAddForm ? (
        <div className="mb-6 rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-medium text-text-primary">New address</h2>
          <AddressForm onSaved={handleSaved} onCancel={() => setShowAddForm(false)} />
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading addresses…</p>
      ) : addresses.length === 0 && !showAddForm ? (
        <p className="text-sm text-text-secondary">You haven&apos;t saved any addresses yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {addresses.map((address) =>
            editingId === address.id ? (
              <div key={address.id} className="rounded-lg border border-border bg-surface p-5">
                <h2 className="mb-4 text-sm font-medium text-text-primary">Edit address</h2>
                <AddressForm initial={address} onSaved={handleSaved} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div key={address.id} className="rounded-lg border border-border bg-background p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{address.fullName}</span>
                      {address.isDefault ? (
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.1em] text-accent">
                          Default
                        </span>
                      ) : null}
                      {address.label ? <span className="text-xs text-text-secondary">({address.label})</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{address.phone}</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.postalCode},{' '}
                      {address.country}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditingId(address.id)}
                      className="font-medium text-primary hover:text-primary-hover"
                    >
                      Edit
                    </button>
                    {!address.isDefault ? (
                      <button
                        type="button"
                        disabled={busyId === address.id}
                        onClick={() => handleSetDefault(address.id)}
                        className="text-text-secondary hover:text-text-primary disabled:cursor-not-allowed"
                      >
                        Set as default
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyId === address.id}
                      onClick={() => handleDelete(address.id)}
                      className="text-danger hover:text-danger/80 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
