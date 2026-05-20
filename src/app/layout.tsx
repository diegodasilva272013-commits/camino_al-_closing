import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { brand } from '@/constants/branding';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: brand.full,
    template: `%s — ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
};

export const viewport: Viewport = {
  themeColor: brand.colors.background,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-brand-black text-brand-text antialiased">
        {children}
      </body>
    </html>
  );
}
