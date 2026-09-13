import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// No header/footer here on purpose: the reference design treats sign-in as a
// standalone centred panel.
export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
