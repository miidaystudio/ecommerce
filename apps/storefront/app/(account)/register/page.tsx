'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { ApiError } from '../../../lib/api/client';
import { useAuth } from '../../../lib/hooks/useAuth';
import { registerSchema, verifyOtpSchema } from '../../../lib/validators/auth.schema';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, verifyOtp, resendOtp } = useAuth();

  const initialEmail = searchParams.get('email') ?? '';
  const initialStep = searchParams.get('step') === 'otp' && initialEmail ? 'otp' : 'details';

  const [step, setStep] = useState<'details' | 'otp'>(initialStep);
  const [registeredEmail, setRegisteredEmail] = useState(initialEmail);
  const [registeredPhone, setRegisteredPhone] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [otp, setOtp] = useState('');
  // Held in memory only, for the verify request. A visitor arriving from the
  // login page's "verify your account" link hasn't typed it here, so they are asked.
  const [pendingPassword, setPendingPassword] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (step !== 'otp' || cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, cooldown]);

  async function onRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const form = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      firstName: form.get('firstName') || undefined,
      lastName: form.get('lastName') || undefined,
      phoneNumber: form.get('phone'),
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
      const result = await register(parsed.data);

      setRegisteredEmail(parsed.data.email);
      setRegisteredPhone(parsed.data.phoneNumber);
      setPendingPassword(parsed.data.password);
      setCooldown(result.resendAvailableIn ?? 60);
      setOtp('');
      setOtpError('');
      setOtpSuccess('Verification code sent to your email.');
      setStep('otp');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  }

  async function onOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOtpError('');
    setOtpSuccess('');

    const parsed = verifyOtpSchema.safeParse({
      email: registeredEmail,
      otp: otp.trim(),
      password: pendingPassword,
    });

    if (!parsed.success) {
      setOtpError(parsed.error.issues[0]?.message ?? 'Enter a valid 4-digit code');
      return;
    }

    setVerifying(true);
    try {
      await verifyOtp(parsed.data);
      setPendingPassword('');
      router.push('/account');
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : 'Failed to verify code');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setOtpError('');
    setOtpSuccess('');
    setResending(true);

    try {
      const result = await resendOtp({ email: registeredEmail });
      setCooldown(result.resendAvailableIn ?? 60);
      setOtpSuccess(result.message ?? 'A new verification code has been sent.');
      setOtp('');
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : 'Unable to resend code');
    } finally {
      setResending(false);
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

          {step === 'details' ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Create account</h1>
              <p className="mt-2 text-sm text-text-secondary">
                Join to check out faster and track orders.
              </p>

              <form onSubmit={onRegisterSubmit} className="mt-8 flex flex-col gap-[18px]" noValidate>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="First name" id="firstName" name="firstName" error={fieldErrors.firstName} />
                  <FormField label="Last name" id="lastName" name="lastName" error={fieldErrors.lastName} />
                </div>
                <FormField
                  label="Phone number"
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  defaultValue={registeredPhone}
                  error={fieldErrors.phoneNumber}
                />
                <FormField
                  label="Email"
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={registeredEmail}
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
                <Button type="submit" disabled={submitting} className="mt-1 w-full">
                  {submitting ? 'Creating account…' : 'Create account'}
                </Button>
              </form>

              <p className="mt-8 text-center text-sm text-text-secondary">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Verify your email</h1>
              <p className="mt-2 text-sm text-text-secondary">
                We sent a 4-digit code to{' '}
                <strong className="font-medium text-text-primary">{registeredEmail}</strong>. Enter it below to activate your account.
              </p>

              <form onSubmit={onOtpSubmit} className="mt-8 flex flex-col gap-5" noValidate>
                <div className="flex flex-col gap-2">
                  <label htmlFor="otp" className="text-sm font-medium text-text-primary">
                    Verification code
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setOtp(val);
                      if (otpError) setOtpError('');
                    }}
                    placeholder="••••"
                    autoFocus
                    className="h-[52px] w-full rounded-[10px] border border-border bg-background px-4 text-center font-mono text-3xl font-semibold tracking-[0.35em] text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {!registeredPhone ? (
                  <FormField
                    label="Password"
                    id="verify-password"
                    name="verify-password"
                    type="password"
                    autoComplete="current-password"
                    value={pendingPassword}
                    onChange={(e) => setPendingPassword(e.target.value)}
                  />
                ) : null}

                {otpError ? <p className="text-sm text-danger">{otpError}</p> : null}
                {otpSuccess ? <p className="text-sm text-success-strong">{otpSuccess}</p> : null}

                <Button type="submit" disabled={verifying || otp.length !== 4} className="mt-1 w-full">
                  {verifying ? 'Verifying…' : 'Verify & Continue'}
                </Button>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <div>
                    {cooldown > 0 ? (
                      <span className="text-text-secondary">
                        Resend code in <strong className="font-medium text-text-primary">{cooldown}s</strong>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="font-medium text-primary hover:text-primary-hover disabled:opacity-50"
                      >
                        {resending ? 'Sending…' : 'Resend code'}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('details');
                      setOtpError('');
                      setOtpSuccess('');
                    }}
                    className="text-text-secondary hover:text-text-primary underline"
                  >
                    Edit details
                  </button>
                </div>
              </form>

              <p className="mt-8 text-center text-sm text-text-secondary">
                Already verified?{' '}
                <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <RegisterForm />
    </Suspense>
  );
}
