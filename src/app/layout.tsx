import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { brand } from '@/constants/branding';
import { PWARegister } from '@/components/pwa-register';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://camino-al-closing.vercel.app'),
  title: {
    default: brand.full,
    template: `%s — ${brand.name}`,
  },
  description: brand.description,
  applicationName: brand.name,
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    url: 'https://camino-al-closing.vercel.app',
    siteName: brand.name,
    title: brand.full,
    description: brand.description,
    locale: 'es_AR',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: brand.full,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: brand.full,
    description: brand.description,
    images: ['/og-image.jpg'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: brand.name,
  },
};

export const viewport: Viewport = {
  themeColor: brand.colors.background,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} dark`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('cac:theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-screen bg-brand-black text-brand-text antialiased">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
