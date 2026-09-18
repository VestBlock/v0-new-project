import { cn } from '@/lib/utils';

type BrandMarkProps = {
  className?: string;
  title?: string;
};

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  showTagline?: boolean;
};

/**
 * The VestBlock convergence mark.
 *
 * The graphite ribbon forms a V while the signal shape completes a subtle B.
 * Together they represent Capital, Deals, and Opportunity converging on one move.
 */
export function BrandMark({ className, title }: BrandMarkProps) {
  return (
    <span className={cn('vb-brand-mark inline-flex shrink-0 items-center justify-center', className)}>
      <svg
        aria-hidden={title ? undefined : true}
        role={title ? 'img' : undefined}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
      >
        {title ? <title>{title}</title> : null}
        <path
          className="vb-brand-mark__field"
          d="M5 7h13.2L32 40.1 45.8 7H59L37.4 57H26.6L5 7Z"
        />
        <path
          className="vb-brand-mark__signal"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M38.4 7H46c8.5 0 13.2 4.3 13.2 11.3 0 4.9-2.5 8.4-7.2 10.3 5.3 1.8 8 5.6 8 11.1C60 50.1 52.9 57 41.6 57H31.2l4.5-10.1h6.6c5.4 0 8.1-2.2 8.1-6.4 0-4-2.8-6.1-8.3-6.1H37l4.4-10h3.7c3.2 0 4.9-1.4 4.9-4.2 0-2.8-1.9-4.2-5.6-4.2h-10L38.4 7Z"
        />
      </svg>
    </span>
  );
}

export function BrandLogo({ className, markClassName, showTagline = false }: BrandLogoProps) {
  return (
    <span className={cn('vb-brand-lockup flex min-w-0 items-center', className)}>
      <BrandMark className={cn('h-9 w-9', markClassName)} />
      <span className="min-w-0">
        <span className="vb-brand-wordmark vb-font-critical block leading-none transition-colors">
          VestBlock
        </span>
        {showTagline ? (
          <span className="vb-brand-tagline mt-1 hidden leading-none xl:block">
            Find your next move
          </span>
        ) : null}
      </span>
    </span>
  );
}
