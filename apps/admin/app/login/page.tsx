'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '../../components/ui/Button';
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
    <main className="flex min-h-screen items-center justify-center bg-admin-sidebar-bg px-4">
      <div className="w-full max-w-sm rounded-md bg-background p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-text-primary">Admin sign in</h1>
        <p className="mt-1 text-sm text-text-secondary">Staff and administrators only.</p>

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
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  );
}
