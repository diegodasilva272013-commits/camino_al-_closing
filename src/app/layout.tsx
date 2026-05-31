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
        {/* Splash inline (no depende de React): aparece al instante */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              #cac-splash{position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;transition:opacity .5s ease}
              #cac-splash.cac-hide{opacity:0;pointer-events:none}
              #cac-splash .cac-bg{position:absolute;width:160px;height:160px;background:url('/Logo2.png') center/contain no-repeat;opacity:.9}
              #cac-splash video{position:absolute;left:50%;top:50%;width:120%;height:120%;transform:translate(-50%,-50%);object-fit:cover;background:#000}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-brand-black text-brand-text antialiased">
        <div id="cac-splash" aria-hidden="true">
          <div className="cac-bg" />
          <video
            src="/Cinematic_logo_reveal_animation_202605311327.mp4"
            autoPlay
            muted
            playsInline
            preload="auto"
          />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var s=document.getElementById('cac-splash');
                if(!s)return;
                var v=s.querySelector('video');
                var done=false;
                function hide(){if(done)return;done=true;s.classList.add('cac-hide');setTimeout(function(){s.remove();},600);}
                if(v){v.addEventListener('ended',hide);v.addEventListener('error',hide);v.play&&v.play().catch(function(){});}
                setTimeout(hide,8000);
                s.addEventListener('click',hide);
              })();
            `,
          }}
        />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
