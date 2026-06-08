'use client';

import Link from 'next/link';
import {
  ArrowRight,
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
import { Badge } from '@/components/ui/badge';
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
      'For developers, contractors, builders, and rehab crews that want project opportunities surfaced when property, capital, or operator fit makes sense.',
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
    <main className="premium-page px-4 py-24">
      <div className="container mx-auto max-w-7xl space-y-10">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit bg-cyan-600 text-white">Start Here</Badge>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
              Choose the VestBlock path that matches your role in the deal.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Start as a seller, buyer, lender, developer, contractor, operator, capital partner, or DealVault team. Once fit is clear, VestBlock can support cleaner intake, funding prep, partner accountability, and follow-through.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <a href="#paths">
                  Choose a path below
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">Compare Pricing</Link>
              </Button>
            </div>
            {isAuthenticated ? (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Signed in account</p>
                <p className="mt-1">
                  You are signed in as {user?.email || 'your account'}. Use the same email on
                  request forms if you want saved plans and updates to show up in your account.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No account needed to start</p>
                <p className="mt-1">
                  Submit the property, buy box, lender profile, deal review, or demo request first. Create an account later only when you want saved activity and dashboard access.
                </p>
              </div>
            )}
          </div>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-600" />
                What opens right away
              </CardTitle>
              <CardDescription>
                Each option gives a serious network member a clear next step before account creation or payment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">Network-first entry</p>
                <p className="mt-1">
                  Seller, buyer, lender, project partner, funding, and DealVault paths all open before account creation.
                </p>
              </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">Support path</p>
                <p className="mt-1">
                  Qualified members can add more support when they need stronger intake, partner materials, or funding prep.
                </p>
              </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">Clear role paths</p>
                <p className="mt-1">
                  Buyer, lender, operator, and partner criteria stay separate, which makes introductions cleaner when a real opportunity appears.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="paths" className="grid gap-6 scroll-mt-24 xl:grid-cols-2">
          {workspaceCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.title} className="premium-card border-cyan-500/20">
                <CardHeader>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {card.bullets.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-cyan-600" />
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
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">For deal-driven teams</CardTitle>
              <CardDescription>
                DealVault is the clearest first path when record proof, payout visibility, and milestones matter.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">For funding prep</CardTitle>
              <CardDescription>
                Start with the free funding check, then move into paid prep or credit support only when the business needs cleanup or sequencing help.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">For added support</CardTitle>
              <CardDescription>
                Intake assets, partner materials, and funding prep can be added when a qualified member needs more support.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </div>
    </main>
  );
}
