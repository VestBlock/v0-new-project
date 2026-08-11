'use client';

import Link from 'next/link';
import {
  Building2,
  CircleDollarSign,
  Hammer,
  Home,
  Landmark,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type WorkspaceCard = {
  title: string;
  description: string;
  icon: typeof Search;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  bullets: string[];
};

const workspaceCards: WorkspaceCard[] = [
  {
    title: 'Seller Property Review',
    description:
      'For property owners who want a sharper review of the address, condition, timeline, price, payoff, and sale context before a fast cash, creative, novation, or partner conversation.',
    icon: Home,
    primaryHref: '/sell',
    primaryLabel: 'Submit Property',
    bullets: [
      'No login required to submit the property',
      'Captures timeline, condition, price, payoff, liens, and preferred sale path',
      'Helps send follow-up toward fast cash, creative, novation, or partner review',
    ],
  },
  {
    title: 'Buyer Buy Box',
    description:
      'For cash buyers, landlords, flippers, institutional buyers, and acquisition teams that want better-fit opportunities introduced by criteria.',
    icon: Users,
    primaryHref: '/buyers',
    primaryLabel: 'Share Buy Box',
    bullets: [
      'Submit markets, asset types, price range, and no-go items',
      'Keep proof status and close speed attached to your profile',
      'Keep your buyer profile ready for better-fit introductions and funding conversations',
    ],
  },
  {
    title: 'Lender Network',
    description:
      'For lenders that want a cleaner partner channel for real estate opportunities that fit their lending box.',
    icon: Landmark,
    primaryHref: '/lenders',
    primaryLabel: 'Join Lender Network',
    bullets: [
      'Share states, loan size, borrower fit, and no-go items',
      'Keep your criteria clean before opportunities are introduced',
      'Keep your lender profile ready for cleaner borrower review and introductions',
    ],
  },
  {
    title: 'Real Estate Funding Review',
    description:
      'For investors or property owners with a DSCR, rental, flip, bridge, or hard-money scenario that needs lender criteria review.',
    icon: Building2,
    primaryHref: '/real-estate-funding',
    primaryLabel: 'Review My Deal',
    secondaryHref: '/services/financial-growth#request-service',
    secondaryLabel: 'Request Paid Review',
    bullets: [
      'Submit the deal, borrower, timeline, and property details',
      'Use partner introductions after the deal context and capital fit are clear',
      'Move into paid review when the file needs more prep',
    ],
  },
  {
    title: 'Developer / Construction Partner',
    description:
      'For developers, contractors, builders, and rehab crews that want project opportunities sent over when property, capital, or operator fit makes sense.',
    icon: Hammer,
    primaryHref: '/real-estate-funding',
    primaryLabel: 'Share Project Fit',
    secondaryHref: '/services',
    secondaryLabel: 'View Network Services',
    bullets: [
      'Share markets, project types, capacity, and preferred deal roles',
      'Keep construction and developer fit separate from lender criteria',
      'Pair project opportunities with cleaner partner review when useful',
    ],
  },
  {
    title: 'DealVault Demo',
    description:
      'For teams that need proof records, payout visibility, partner accountability, and milestone tracking in one deal-ready path.',
    icon: ShieldCheck,
    primaryHref: '/dealvault/demo',
    primaryLabel: 'See DealVault Demo',
    secondaryHref: '/smart-contracts',
    secondaryLabel: 'View Smart Contracts',
    bullets: [
      'See the proof-record, payout, and milestone flow first',
      'Review DealVault records without a wallet requirement',
      'Use the same account if you want follow-up and demo requests saved',
    ],
  },
  {
    title: 'Business Funding Prep',
    description:
      'For founders and business owners who want a quick funding check, then guided help if they need more preparation.',
    icon: CircleDollarSign,
    primaryHref: '/funding',
    primaryLabel: 'Check Funding Free',
    secondaryHref: '/funding/business-funding-strategy',
    secondaryLabel: 'See Funding Prep Pricing',
    bullets: [
      'Run the free eligibility check first',
      'Move into the $300 Business Funding Prep Plan only when needed',
      'Use credit and prep tools only when the funding file needs more work',
    ],
  },
] as const;

export function GetStartedPage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <main className="vb-page px-4 py-24">
      <div className="container mx-auto max-w-7xl space-y-10">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-5">
            <p className="vb-eyebrow">Start with the outcome</p>
            <h1 className="max-w-4xl text-4xl font-medium tracking-tight md:text-6xl">
              Tell us where you&apos;re trying to go.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Choose capital, deals, or opportunities first. VestBlock will route you into the relevant funding, property, partner, or business workflow already built for that job.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Button asChild size="lg">
                <Link href="/capital">Find capital</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/deals">Find deals</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/opportunities">Explore opportunities</Link>
              </Button>
            </div>
            {isAuthenticated ? (
              <div className="border-y border-[#b7ff3c]/20 py-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Signed in account</p>
                <p className="mt-1">
                  You are signed in as {user?.email || 'your account'}. Use the same email on
                  request forms if you want saved plans and updates to show up in your account.
                </p>
              </div>
            ) : (
              <div className="border-y border-white/10 py-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No account needed to start</p>
                <p className="mt-1">
                  Submit the property, buy box, lender profile, deal review, or demo request first. Create an account later only when you want saved activity and dashboard access.
                </p>
              </div>
            )}
          </div>

          <Card className="border-white/10 bg-[#0e1114] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#b7ff3c]" />
                Start before you sign up
              </CardTitle>
              <CardDescription>
                Each option gives a serious network member a clear next step before account creation or payment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="border-t border-white/10 pt-4">
                <p className="font-medium text-foreground">Network-first entry</p>
                <p className="mt-1">
                  Seller, buyer, lender, project partner, funding, and DealVault paths all open before account creation.
                </p>
              </div>
                <div className="border-t border-white/10 pt-4">
                <p className="font-medium text-foreground">Support path</p>
                <p className="mt-1">
                  Qualified members can add more support when they need stronger intake, partner materials, or funding prep.
                </p>
              </div>
                <div className="border-t border-white/10 pt-4">
                <p className="font-medium text-foreground">Clear role paths</p>
                <p className="mt-1">
                  Buyer, lender, operator, and partner criteria stay separate, which makes introductions cleaner when a real opportunity appears.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="paths" className="scroll-mt-24 space-y-6">
          <div>
            <p className="vb-eyebrow">Or start with your role</p>
            <h2 className="mt-3 text-3xl font-medium tracking-tight">Choose the workflow that fits.</h2>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
          {workspaceCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.title} className="border-white/10 bg-[#0e1114] shadow-none">
                <CardHeader>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-[#b7ff3c]/10 text-[#b7ff3c]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {card.bullets.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-[#b7ff3c]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href={card.primaryHref}>{card.primaryLabel}</Link>
                    </Button>
                    {card.secondaryHref && card.secondaryLabel ? (
                    <Button asChild variant="outline">
                        <Link href={card.secondaryHref}>
                          {card.secondaryLabel}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </section>

      </div>
    </main>
  );
}
