import Link from 'next/link';
import { brand } from '@/constants/branding';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-black px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(212,175,55,0.08),transparent_60%)]" />
      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gold-gradient text-[#0a0a0a] font-bold">
            C
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">{brand.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-brand-gold">
              {brand.tagline}
            </p>
          </div>
        </Link>
        <div className="card-premium">{children}</div>
      </div>
    </div>
  );
}
