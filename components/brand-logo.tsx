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
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-[0_0_26px_rgba(34,211,238,0.22)]',
        className
      )}
    >
      <img
        src="/vestblock-mark.png"
        alt=""
        aria-hidden="true"
        className="h-full w-full object-cover"
      />
    </span>
  );
}

export function BrandLogo({ className, markClassName, showTagline = false }: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className={cn('h-8 w-8', markClassName)} />
      <span className="min-w-0">
        <span className="block text-base font-bold leading-none tracking-tight text-white transition-colors group-hover:text-cyan-100">
          VestBlock
        </span>
        {showTagline ? (
          <span className="mt-1 hidden text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-cyan-200/75 xl:block">
            Real estate partner network
          </span>
        ) : null}
      </span>
    </span>
  );
}
