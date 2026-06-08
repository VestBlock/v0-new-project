import Link from 'next/link';
import { ArrowRight, Building2, FileCheck2, Network, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const revenuePaths = [
  {
    title: 'DealVault demo',
    body: 'See how a sample agreement becomes a clean record, milestone history, payout view, and proof certificate.',
    href: '/dealvault/demo',
    cta: 'View the demo',
    icon: FileCheck2,
  },
  {
    title: 'Smart contract records',
    body: 'Review the records VestBlock creates around seller intake, criteria, DealVault, and payouts.',
    href: '/proof',
    cta: 'Open record library',
    icon: ShieldCheck,
  },
  {
    title: 'DealFlow Growth Support',
    body: 'See the premium support package that combines seller intake, buyer and lender criteria review, DealVault, and response support.',
    href: '/dealflow-growth-system',
    cta: 'View support',
    icon: Network,
  },
  {
    title: 'Real estate funding review',
    body: 'Open the capital path for DSCR, bridge, fix-and-flip, rental, and construction scenarios that need lender criteria review.',
    href: '/real-estate-funding',
    cta: 'Open funding path',
    icon: Building2,
  },
] as const;

type RevenuePathLinksProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function RevenuePathLinks({
  eyebrow = 'Proof and product paths',
  title = 'Start with the pages that show what VestBlock can do.',
  description = 'These links connect visitors to the clearest demos, proof pages, and revenue-focused services without forcing a login first.',
}: RevenuePathLinksProps) {
  return (
    <section className="premium-section p-6 md:p-8">
      <div className="flex flex-col gap-3 md:max-w-3xl">
        <Badge variant="outline" className="w-fit">
          {eyebrow}
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground md:text-base">
          {description}
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {revenuePaths.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-cyan-500/[0.06] hover:shadow-[0_18px_42px_rgba(8,145,178,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200 transition-colors group-hover:border-cyan-200/50 group-hover:bg-cyan-400/20">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 font-semibold">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-cyan-200">
                {item.cta}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
