import type { Metadata } from 'next';
import { Manrope, Inter, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '../components/auth/AuthProvider';
import { SITE_URL } from '../lib/utils/site-url';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  // metadataBase makes every relative canonical and OG image below resolve to
  // an absolute URL, which both require.
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'miiday — everything for a slower home',
    // Page titles fill the %s, so each page reads as "<page> · miiday".
    template: '%s · miiday',
  },
  description: 'Everything for a slower home — shop across multiple product categories.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'miiday',
    title: 'miiday — everything for a slower home',
    description: 'Everything for a slower home — shop across multiple product categories.',
    url: '/',
  },
  twitter: { card: 'summary_large_image' },
  robots: {
    // Account, cart and checkout are per-user pages with nothing to index.
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background text-text-primary antialiased" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
