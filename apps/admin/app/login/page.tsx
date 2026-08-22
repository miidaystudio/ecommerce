'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { FormField } from '../../components/ui/FormField';
import { ApiError } from '../../lib/api/client';
import { useAuth } from '../../lib/hooks/useAuth';
import { loginSchema } from '../../lib/validators/auth.schema';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get('email'),
      password: form.get('password'),
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await login(parsed.data);
      router.replace('/');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-admin-sidebar-bg px-4 py-12">
      <div className="absolute left-6 top-6 flex items-center gap-2 text-sm text-admin-sidebar-text sm:left-10 sm:top-8">
        <span className="h-2 w-2 rounded-sm bg-accent" />
        miiday · admin
      </div>
      <div className="absolute bottom-6 right-6 hidden text-xs text-admin-sidebar-section-label sm:block sm:right-10 sm:bottom-8">
        Need access? Contact your admin
      </div>

      <div className="w-full max-w-[420px] rounded-lg bg-background p-8 shadow-2xl sm:p-10">
        <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-sm bg-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FAF9F6" strokeWidth="2">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">Sign in to admin</h1>
        <p className="mt-1.5 text-sm text-text-secondary">Staff and administrators only.</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
          <FormField
            label="Email"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            error={fieldErrors.email}
          />
          <FormField
            label="Password"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={fieldErrors.password}
          />
          {formError ? <p className="text-sm text-danger">{formError}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 h-11 rounded bg-accent text-sm font-semibold text-admin-sidebar-bg transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center font-mono text-2xs text-text-secondary">
          STAFF · SUPER_ADMIN · endpoint /auth/admin/login
        </div>
      </div>
    </main>
  );
}
