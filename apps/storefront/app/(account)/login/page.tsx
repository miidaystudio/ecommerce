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
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-surface p-12 md:flex">
        <span className="font-mono text-2xs uppercase tracking-[0.15em] text-text-secondary">
          New season · linen &amp; oak
        </span>
        <div>
          <p className="max-w-sm text-hero text-[40px] font-medium leading-tight tracking-tight text-text-primary">
            Everything for a slower home.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 md:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 text-lg font-bold tracking-tight text-text-primary">
            miiday<span className="text-accent">.</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Sign in</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Access your orders, addresses, and wishlist.
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-[18px]" noValidate>
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
            <Button type="submit" disabled={submitting} className="mt-1 w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-text-secondary">
            New here?{' '}
            <Link href="/register" className="font-medium text-primary hover:text-primary-hover">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
