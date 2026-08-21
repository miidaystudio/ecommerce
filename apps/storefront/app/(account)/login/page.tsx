'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { ApiError } from '../../../lib/api/client';
import { useAuth } from '../../../lib/hooks/useAuth';
import { loginSchema } from '../../../lib/validators/auth.schema';

export default function LoginPage() {
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
      router.push('/account');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold text-text-primary">Sign in</h1>
      <p className="mt-1 text-sm text-text-secondary">Access your orders, addresses, and wishlist.</p>

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

      <p className="mt-4 text-sm text-text-secondary">
        New here?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
