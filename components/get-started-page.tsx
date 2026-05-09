'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  CircleDollarSign,
  Home,
  Search,
  Sparkles,
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
    title: 'Visibility Plans',
    description:
      'For service businesses that want clearer search growth without a vague marketing retainer.',
    icon: Search,
    primaryHref: '/visibility-expansion',
    primaryLabel: 'View Search Visibility',
    bullets: [
      'Compare productized visibility packages',
      'Preview sample page ideas and next-step recommendations',
      'Save your request in your account if you want to come back later',
    ],
  },
  {
    title: 'AI Receptionist Preview',
    description:
      'For businesses that need better lead capture, booking, and a cleaner front-desk experience before buying more traffic.',
    icon: Bot,
    primaryHref: '/ai-assistant',
    primaryLabel: 'View AI Receptionist',
    bullets: [
      'Choose the package that fits your current need',
      'Preview bot questions and website improvement ideas',
      'Use the same email if you want to save your request in one place',
    ],
  },
  {
    title: 'Business Funding',
    description:
      'For founders and business owners who want a quick funding check, then guided help if they need more preparation.',
    icon: CircleDollarSign,
    primaryHref: '/funding',
    primaryLabel: 'Check Funding',
    secondaryHref: '/pricing#funding-assistant-plans',
    secondaryLabel: 'See Funding Pricing',
    bullets: [
      'Run the free eligibility check first',
      'Move into a saved funding plan when you are ready',
      'Keep lender-facing prep and key notes in one place',
    ],
  },
  {
    title: 'Real Estate Services',
    description:
      'For buyers, lenders, and sellers who need a cleaner place to start the conversation around property opportunities and funding.',
    icon: Home,
    primaryHref: '/real-estate-funding',
    primaryLabel: 'Open Real Estate Services',
    secondaryHref: '/sell',
    secondaryLabel: 'Submit Property',
    bullets: [
      'Start with deal review, funding conversations, or property submissions',
      'Keep real-estate visitors from feeling lost in a general small-business site',
      'Use the pricing page when you need more hands-on support',
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
              Choose the VestBlock service that fits what you need today.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Service businesses can preview visibility or AI receptionist options. Business owners can
              start with funding. Buyers, lenders, and sellers can go straight to the real-estate pages.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href={isAuthenticated ? '/dashboard/services' : '/register?redirect=/get-started'}>
                  {isAuthenticated ? 'Open My Dashboard' : 'Create Account'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={isAuthenticated ? '/pricing' : '/login?redirect=/get-started'}>
                  {isAuthenticated ? 'Compare Pricing' : 'Sign In'}
                </Link>
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
                <p className="font-medium text-foreground">Best setup for new clients</p>
                <p className="mt-1">
                  Create an account first if you want your requests, previews, and follow-up in one place.
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
                Each option should give the client something useful right away, even before a higher-touch follow-up starts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">Live offer previews</p>
                <p className="mt-1">
                  Visibility and AI receptionist pages now show sample recommendations before you submit anything.
                </p>
              </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">Saved account activity</p>
                <p className="mt-1">
                  If you use the same email, you can come back later and review saved requests and updates.
                </p>
              </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">A self-serve funding check</p>
                <p className="mt-1">
                  Funding already gives people a clear first step: free check first, saved recommendations second, extra help when needed.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
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
                        <Link
                          href={
                            isAuthenticated && card.title === 'Business Funding'
                              ? '/dashboard/funding'
                              : card.secondaryHref
                          }
                        >
                          {isAuthenticated && card.title === 'Business Funding'
                            ? 'Open Funding Dashboard'
                            : card.secondaryLabel}
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
              <CardTitle className="text-lg">For small businesses</CardTitle>
              <CardDescription>
                Visibility and AI receptionist are the cleanest productized starting points today.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">For lenders and buyers</CardTitle>
              <CardDescription>
                Funding and real-estate services stay visible here so capital partners and buyers still feel expected.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">For sellers</CardTitle>
              <CardDescription>
                Seller submissions still matter, but they no longer define the whole brand.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </div>
    </main>
  );
}
