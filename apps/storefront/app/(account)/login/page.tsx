'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
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
  const [lastEmail, setLastEmail] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const form = new FormData(event.currentTarget);
    const emailVal = (form.get('email') as string) || '';
    setLastEmail(emailVal);
    const parsed = loginSchema.safeParse({
      email: emailVal,
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
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#F9F8F5] text-[#121212] px-6 py-12 font-sans selection:bg-neutral-900 selection:text-white">
      
      {/* Top Left Navigation: Back to Home */}
      <div className="absolute left-6 top-6 sm:left-10 sm:top-8 z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-neutral-600 hover:text-neutral-950 transition-colors bg-white border border-neutral-200/80 px-4 py-2 rounded-full shadow-2xs"
        >
          <span>←</span>
          <span>BACK TO HOME</span>
        </Link>
      </div>

      {/* Top Right System Status */}
      <div className="absolute right-6 top-6 sm:right-10 sm:top-8 hidden sm:flex items-center gap-2 font-mono text-2xs text-neutral-400 uppercase tracking-widest">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>MIIDAY STUDIO // ATELIER GATEWAY</span>
      </div>

      {/* Central Login Container */}
      <div className="w-full max-w-[420px] rounded-3xl bg-white border border-neutral-200/90 p-8 sm:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        
        {/* Brand Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-neutral-950">
              <rect x="2" y="2" width="20" height="20" rx="6" fill="#121212" />
              <path d="M7 12L10 15L17 8" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-black text-lg uppercase tracking-tight text-neutral-950">MIIDAY</span>
          </div>
          <span className="font-mono text-3xs font-black uppercase px-2 py-0.5 rounded bg-neutral-950 text-emerald-400 border border-emerald-400/30">
            SHOP
          </span>
        </div>

        <h1 className="text-2xl font-black uppercase tracking-tight text-neutral-950">
          SIGN IN TO ACCOUNT
        </h1>
        <p className="mt-1 text-xs font-mono text-neutral-500">
          Access your orders, addresses &amp; telemetry wishlist.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4 font-mono text-xs" noValidate>
          <FormField
            label="EMAIL ADDRESS"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            error={fieldErrors.email}
          />
          <FormField
            label="PASSWORD"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={fieldErrors.password}
          />

          {formError ? (
            <div className="flex flex-col gap-1 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-bold">
              <p>{formError}</p>
              {formError.toLowerCase().includes('verif') ? (
                <Link
                  href={`/register?step=otp${lastEmail ? `&email=${encodeURIComponent(lastEmail)}` : ''}`}
                  className="font-medium underline hover:text-rose-800"
                >
                  Enter verification code
                </Link>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 h-11 w-full rounded-full bg-neutral-950 text-xs font-mono font-bold uppercase tracking-wider text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-md"
          >
            {submitting ? 'SIGNING IN…' : 'SIGN IN →'}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-xs text-neutral-500">
          NEW HERE?{' '}
          <Link href="/register" className="font-bold text-neutral-950 underline hover:text-emerald-600 transition-colors">
            CREATE AN ACCOUNT
          </Link>
        </p>

      </div>

    </main>
  );
}
