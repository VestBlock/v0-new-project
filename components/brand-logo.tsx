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
        'vb-brand-mark relative inline-flex aspect-square shrink-0 items-center justify-center overflow-hidden border',
        className
      )}
    >
      <span className="relative z-10 text-[0.72rem] font-black tracking-[-0.08em]">VB</span>
      <span className="vb-brand-mark__rule absolute inset-x-0 bottom-0 h-1" />
    </span>
  );
}

export function BrandLogo({ className, markClassName, showTagline = false }: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className={cn('h-8 w-8', markClassName)} />
      <span className="min-w-0">
        <span className="vb-brand-wordmark block text-base font-bold leading-none tracking-tight transition-colors">
          VestBlock
        </span>
        {showTagline ? (
          <span className="vb-brand-tagline mt-1 hidden text-xs font-medium uppercase leading-none tracking-[0.12em] xl:block">
            Find your next move
          </span>
        ) : null}
      </span>
    </span>
  );
}
