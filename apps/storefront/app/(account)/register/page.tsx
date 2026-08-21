'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { ApiError } from '../../../lib/api/client';
import { useAuth } from '../../../lib/hooks/useAuth';
import { registerSchema } from '../../../lib/validators/auth.schema';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const form = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      firstName: form.get('firstName') || undefined,
      lastName: form.get('lastName') || undefined,
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
      await register(parsed.data);
      router.push('/account');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold text-text-primary">Create account</h1>
      <p className="mt-1 text-sm text-text-secondary">Join to check out faster and track orders.</p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="First name" id="firstName" name="firstName" error={fieldErrors.firstName} />
          <FormField label="Last name" id="lastName" name="lastName" error={fieldErrors.lastName} />
        </div>
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
          autoComplete="new-password"
          error={fieldErrors.password}
        />
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-4 text-sm text-text-secondary">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
