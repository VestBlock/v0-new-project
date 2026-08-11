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
        'inline-flex shrink-0 items-center justify-center',
        className
      )}
    >
      <Image
        src="/brand/vestblock-monogram.png"
        alt=""
        aria-hidden="true"
        width={96}
        height={96}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export function BrandLogo({ className, markClassName, showTagline = false }: BrandLogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className={cn('h-9 w-9', markClassName)} />
      <span className="min-w-0">
        <span className="block text-base font-bold leading-none tracking-[-0.03em] text-[#f3efe6] transition-colors group-hover:text-[#b7ff3c]">
          VestBlock
        </span>
        {showTagline ? (
          <span className="mt-1 hidden text-[9px] font-medium uppercase leading-none tracking-[0.18em] text-[#8f9189] xl:block">
            Capital · Deals · Opportunity
          </span>
        ) : null}
      </span>
    </span>
  );
}
