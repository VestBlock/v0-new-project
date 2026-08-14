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
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-[var(--vb-obsidian)] shadow-[0_12px_28px_rgba(0,0,0,0.28)]',
        className
      )}
    >
      <Image
        src="/vestblock-mark-platform-ai-3d.png"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="40px"
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export function BrandLogo({ className, markClassName, showTagline = false }: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className={cn('h-10 w-10', markClassName)} />
      <span className="min-w-0">
        <span className="block text-base font-bold leading-none tracking-tight text-[var(--vb-paper)] transition-colors group-hover:text-[#efff87]">
          VestBlock
        </span>
        {showTagline ? (
          <span className="mt-1 hidden text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-[var(--vb-signal)]/80 xl:block">
            Find your next move
          </span>
        ) : null}
      </span>
    </span>
  );
}
