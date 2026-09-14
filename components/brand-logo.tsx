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
      aria-hidden="true"
      className={cn(
        'relative inline-flex aspect-square shrink-0 items-center justify-center overflow-hidden border border-[#d7f80b]/55 bg-[#d7f80b] text-[#0a0e0c] shadow-[0_8px_24px_rgba(215,248,11,0.12)]',
        className
      )}
    >
      <span className="relative z-10 text-[0.72rem] font-black tracking-[-0.08em]">VB</span>
      <span className="absolute inset-x-0 bottom-0 h-1 bg-[#101612]/20" />
    </span>
  );
}

export function BrandLogo({ className, markClassName, showTagline = false }: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className={cn('h-8 w-8', markClassName)} />
      <span className="min-w-0">
        <span className="block text-base font-bold leading-none tracking-tight text-white transition-colors group-hover:text-[#efff87]">
          VestBlock
        </span>
        {showTagline ? (
          <span className="mt-1 hidden text-xs font-medium uppercase leading-none tracking-[0.14em] text-[#d7f80b]/80 xl:block">
            Decision infrastructure
          </span>
        ) : null}
      </span>
    </span>
  );
}
