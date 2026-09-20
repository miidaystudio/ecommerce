import type { Metadata } from 'next';
import { Space_Grotesk, Space_Mono, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '../components/auth/AuthProvider';
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
  title: 'MIIDAY ADMIN // Operations Telemetry',
  description: 'Manage products, orders, customers, and store operations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#F8F7F4] text-[#121212] antialiased font-sans selection:bg-neutral-900 selection:text-white" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
