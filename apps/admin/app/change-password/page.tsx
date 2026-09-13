'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { FormField } from '../../components/ui/FormField';
import { ApiError } from '../../lib/api/client';
import { useAuth } from '../../lib/hooks/useAuth';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { changePassword, logout } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') ?? '');
    const newPassword = String(form.get('newPassword') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    const errors: Record<string, string> = {};

    if (!currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'New password must be at least 8 characters long';
    } else if (newPassword === currentPassword) {
      errors.newPassword = 'New password must be different from current password';
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      await changePassword({ currentPassword, newPassword });
      router.replace('/');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Unable to change password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-admin-sidebar-bg px-4 py-12">
      <div className="absolute left-6 top-6 flex items-center gap-2 text-sm text-admin-sidebar-text sm:left-10 sm:top-8">
        <span className="h-2 w-2 rounded-sm bg-accent" />
        miiday · admin security
      </div>

      <div className="w-full max-w-[420px] rounded-lg bg-background p-8 shadow-2xl sm:p-10">
        <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-sm bg-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FAF9F6" strokeWidth="2">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-text-primary">
          Change temporary password
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          For security, you must set a new personal password before accessing the dashboard.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <FormField
            label="Current temporary password"
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            error={fieldErrors.currentPassword}
          />
          <FormField
            label="New password (min 8 characters)"
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            error={fieldErrors.newPassword}
          />
          <FormField
            label="Confirm new password"
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            error={fieldErrors.confirmPassword}
          />

          {formError ? <p className="text-sm text-danger">{formError}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 h-11 rounded bg-accent text-sm font-semibold text-admin-sidebar-bg transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Updating password…' : 'Set new password & continue'}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center">
          <button
            type="button"
            onClick={() => void logout().then(() => router.replace('/login'))}
            className="text-xs text-text-secondary hover:text-text-primary hover:underline"
          >
            Sign out and return to login
          </button>
        </div>
      </div>
    </main>
  );
}
