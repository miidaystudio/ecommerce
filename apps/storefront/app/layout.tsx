import type { Metadata } from 'next';
import { Space_Grotesk, Space_Mono, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '../components/auth/AuthProvider';
import { SITE_URL } from '../lib/utils/site-url';
import { SmoothScrollProvider } from '../components/providers/SmoothScrollProvider';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'MIIDAY STUDIO // Digital Flagship',
    template: '%s · MIIDAY',
  },
  description: 'Ultra-refined high-fashion editorial digital flagship.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'MIIDAY STUDIO',
    title: 'MIIDAY STUDIO // Digital Flagship',
    description: 'Ultra-refined high-fashion editorial digital flagship.',
    url: '/',
  },
  twitter: { card: 'summary_large_image' },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#F9F8F5] text-[#121212] antialiased selection:bg-neutral-900 selection:text-white font-sans" suppressHydrationWarning>
        <AuthProvider>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
