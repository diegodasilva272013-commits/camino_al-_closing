import Image from 'next/image';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<Size, { box: string; px: number }> = {
  sm: { box: 'h-8 w-8', px: 32 },
  md: { box: 'h-9 w-9', px: 36 },
  lg: { box: 'h-12 w-12', px: 48 },
  xl: { box: 'h-20 w-20', px: 80 },
};

type Props = {
  size?: Size;
  className?: string;
  priority?: boolean;
};

/**
 * Logo de la plataforma. Recorta la imagen en círculo con un anillo dorado
 * para que el fondo gris original quede disimulado sobre el negro de marca.
 */
export function BrandLogo({ size = 'md', className, priority }: Props) {
  const { box, px } = SIZE_MAP[size];
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-full border border-[rgba(212,175,55,0.45)] bg-[#0a0a0a] shadow-[0_0_0_1px_rgba(212,175,55,0.08),0_8px_30px_-12px_rgba(212,175,55,0.35)]',
        box,
        className
      )}
    >
      <Image
        src="/logo.jpeg"
        alt="Camino al Closing"
        width={px}
        height={px}
        priority={priority}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
