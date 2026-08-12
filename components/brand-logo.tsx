import Image from 'next/image';
import { cn } from '@/lib/utils';

type BrandMarkProps = {
  className?: string;
};

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  showTagline?: boolean;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-[#0a0e0c] shadow-[0_12px_28px_rgba(0,0,0,0.28)]',
        className
      )}
    >
      <Image
        src="/vestblock-vb-mark-lime.png"
        alt=""
        aria-hidden="true"
        fill
        sizes="44px"
        className="h-full w-full object-cover"
      />
    </span>
  );
}

export function BrandLogo({ className, markClassName, showTagline = false }: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className={cn('h-8 w-11', markClassName)} />
      <span className="min-w-0">
        <span className="block text-base font-bold leading-none tracking-tight text-white transition-colors group-hover:text-[#efff87]">
          VestBlock
        </span>
        {showTagline ? (
          <span className="mt-1 hidden text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-[#d7f80b]/80 xl:block">
            Real estate opportunity platform
          </span>
        ) : null}
      </span>
    </span>
  );
}
