import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileSearch,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { getFundingPaymentPlans } from '@/lib/funding/payment-plans';
import { pricedVestBlockOffers } from '@/lib/services/pricedOffers';
import { vestBlockServiceDirectory } from '@/lib/services/serviceDirectory';
import { absoluteUrl } from '@/lib/seo/site';
import { MarketingReveal } from '@/components/marketing/reveal';

export const metadata: Metadata = {
  title: 'VestBlock Pricing',
  description:
    'Compare VestBlock pricing for DealVault, Visibility Expansion, AI Receptionist, and optional support services.',
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'VestBlock Pricing',
    description:
      'See VestBlock pricing for DealVault, Visibility Expansion, AI Receptionist, and support services.',
    url: absoluteUrl('/pricing'),
  },
};

const freeStartingPoints = vestBlockServiceDirectory.filter(
  (service) => service.serviceStage === 'free_check' || service.serviceStage === 'lead_followup'
);

const corePaidOffers = vestBlockServiceDirectory.filter(
  (service) => service.serviceStage === 'member_tool' || service.serviceStage === 'paid_plan'
);

const highlightPackages = pricedVestBlockOffers.filter((offer) =>
  [
    'funding_readiness_snapshot',
    'debt_utilization_plan',
    'business_credit_builder_sprint',
    'real_estate_deal_review',
  ].includes(offer.key)
);

const fundingPlans = getFundingPaymentPlans().plans;
const growthAutomationOffers = pricedVestBlockOffers.filter(
  (offer) => offer.category === 'growth_automation'
);
const visibilityExpansionOffers = pricedVestBlockOffers.filter(
  (offer) => offer.category === 'visibility_expansion'
);
const fundingPlanOfferByKey = Object.fromEntries(
  pricedVestBlockOffers
    .filter((offer) => offer.category === 'funding_assistant')
    .map((offer) => [offer.key, offer])
);

export default function PricingPage() {
  return (
    <main className="premium-page px-4 py-24">
      <div className="container mx-auto max-w-7xl space-y-12">
        <MarketingReveal>
        <section className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit bg-cyan-600 text-white">Pricing</Badge>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
              Clear pricing for the products people ask for most.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Start with DealVault, Search Visibility, or AI Receptionist. Add funding, preparation, or higher-touch support when the work needs it.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="/dealvault/demo">
                  See DealVault Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/visibility-expansion">See Search Visibility</Link>
              </Button>
            </div>
          </div>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-600" />
                How VestBlock pricing works
              </CardTitle>
              <CardDescription>
                Choose the main service first, then add support if the project becomes more complex.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>DealVault is built for teams that need stronger records, payout visibility, and milestone tracking.</p>
              <p>Search Visibility and AI Receptionist help businesses win more qualified demand and respond better once it arrives.</p>
              <p>Funding and preparation services are available when a business needs cleanup, preparation, or more guided help.</p>
              <p>Higher-touch support is best for teams that want custom review, custom setup, or deeper guidance.</p>
            </CardContent>
          </Card>
        </section>
        </MarketingReveal>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle>Core products</CardTitle>
              <CardDescription>
                These are the main paid offers most customers compare first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_14px_38px_rgba(8,145,178,0.12)]">
                <p className="font-medium">DealVault</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Premium proof records, payout ledgers, and milestone tracking for deal-driven businesses.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link href="/dealvault/demo">See Demo</Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_14px_38px_rgba(8,145,178,0.12)]">
                <p className="font-medium">Search visibility</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search coverage, city pages, service pages, and stronger trust.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link href="/visibility-expansion">Open Visibility</Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_14px_38px_rgba(8,145,178,0.12)]">
                <p className="font-medium">AI receptionist and booking</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Better lead capture, booking flow, and front-desk coverage before spending more on ads.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link href="/ai-assistant">Open AI Receptionist</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Support services are still available</CardTitle>
              <CardDescription>
                Funding, setup, and preparation services are still available when a team needs extra support.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Funding services stay available for founders who need preparation or capital support.</p>
              <p>Real-estate submission routes stay visible for team and seller conversations that are not yet a DealVault match.</p>
              <p>Higher-touch reviews remain available when the opportunity or file needs more hands-on work.</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                <CircleDollarSign className="h-5 w-5" />
              </div>
              <CardTitle>Free starting points</CardTitle>
              <CardDescription>
                Best for visitors who want a useful first step before they commit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {freeStartingPoints.slice(0, 4).map((service) => (
                <div key={service.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{service.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{service.priceNote}</p>
                    </div>
                    <Badge variant="outline">Free first step</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="premium-card border-cyan-500/30 shadow-lg shadow-cyan-500/10">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-200">
                <FileSearch className="h-5 w-5" />
              </div>
              <CardTitle>Core paid services</CardTitle>
              <CardDescription>
                Best for customers who want a clearer plan before they apply, dispute, or move funds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {corePaidOffers.slice(0, 3).map((service) => (
                <div key={service.key} className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40">
                  <p className="font-medium">{service.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{service.priceNote}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{service.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={service.route}>{service.primaryCta}</Link>
                    </Button>
                    {service.secondaryRoute && service.secondaryCta && (
                      <Button asChild size="sm" variant="outline">
                        {service.secondaryRoute.startsWith('http') ? (
                          <a href={service.secondaryRoute} target="_blank" rel="noopener noreferrer">
                            {service.secondaryCta}
                          </a>
                        ) : (
                          <Link href={service.secondaryRoute}>{service.secondaryCta}</Link>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-emerald-300/40">
                <p className="font-medium">Popular sequence</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Many customers start with a free funding check, move into credit tools
                  or a snapshot, then choose the $300 plan before using a
                  higher-touch service.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <CardTitle>Higher-touch support</CardTitle>
              <CardDescription>
                Use these when you want deeper guidance, review, or help getting your file ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {highlightPackages.slice(0, 4).map((servicePackage) => (
                <div key={servicePackage.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{servicePackage.title}</p>
                    <Badge variant="outline">{servicePackage.priceLabel}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{servicePackage.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/services/${servicePackage.slug}`}>View Service</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={servicePackage.primaryRoute}>{servicePackage.primaryCta}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section id="growth-automation" className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Lead capture and website services</h2>
            <p className="max-w-3xl text-muted-foreground">
              These offers are for businesses that need stronger lead capture, appointment flow,
              or a better website experience before they spend more on traffic.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {growthAutomationOffers.map((offer) => (
              <Card key={offer.key} className="premium-card border-cyan-500/20">
                <CardHeader>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <Badge variant="outline">{offer.priceLabel}</Badge>
                    <Badge className="bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                      Growth service
                    </Badge>
                  </div>
                  <CardTitle>{offer.title}</CardTitle>
                  <CardDescription>{offer.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Best for</p>
                    <p className="mt-1 text-sm text-muted-foreground">{offer.bestFor}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {offer.deliverables.slice(0, 4).map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild>
                      <Link href={`/services/${offer.slug}`}>View Service</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={offer.primaryRoute}>{offer.primaryCta}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="visibility-expansion" className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Search visibility plans</h2>
            <p className="max-w-3xl text-muted-foreground">
              These offers package local search improvements, city pages, and credibility-building work into clearer
              recurring plans instead of open-ended marketing retainers.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {visibilityExpansionOffers.map((offer) => (
              <Card key={offer.key} className="premium-card border-cyan-500/20">
                <CardHeader>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <Badge variant="outline">{offer.priceLabel}</Badge>
                    <Badge className="bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                      Visibility
                    </Badge>
                  </div>
                  <CardTitle>{offer.title}</CardTitle>
                  <CardDescription>{offer.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Best for</p>
                    <p className="mt-1 text-sm text-muted-foreground">{offer.bestFor}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {offer.deliverables.slice(0, 4).map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild>
                      <Link href={`/services/${offer.slug}`}>View Service</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={offer.primaryRoute}>{offer.primaryCta}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="funding-assistant-plans" className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Funding prep options</h2>
            <p className="max-w-3xl text-muted-foreground">
              These options give you different levels of funding guidance, organization,
              and support. They are support offers, not approval promises.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-4">
            {fundingPlans.map((plan) => {
              const planOffer = fundingPlanOfferByKey[plan.id];

              return (
              <Card key={plan.id} className="premium-card flex h-full flex-col">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="outline">{plan.requiresAdminReview ? 'Guided support' : 'Self-serve'}</Badge>
                    <BadgeDollarSign className="h-4 w-4 text-cyan-600" />
                  </div>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div>
                    <p className="text-3xl font-bold">
                      {plan.price > 0 ? `$${plan.discountedPrice ?? plan.price}` : 'Custom'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {plan.price > 0 && plan.discountedPrice && plan.discountedPrice !== plan.price
                        ? `Standard price $${plan.price}`
                        : plan.price > 0
                          ? 'Fixed plan price before any optional lender-related success fee applies'
                          : 'Custom pricing available when additional review is needed'}
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {planOffer && (
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      <Button asChild size="sm">
                        <Link href={`/services/${planOffer.slug}`}>View Service</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={planOffer.primaryRoute}>{planOffer.primaryCta}</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle>How to choose the right plan</CardTitle>
              <CardDescription>
                Pick the option that matches how much guidance you want right now.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Start with a free check when you need a quick answer</p>
                <p>
                  If you want to understand eligibility before paying for help, start with a free funding or preparation check.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Choose a paid review when you need a clearer action plan</p>
                <p>
                  Paid reviews are best when you want document guidance, next steps, and a stronger plan before you apply or submit.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Use higher-support packages when timing and risk matter more</p>
                <p>
                  If the case is more complex, higher-support packages can help you prepare more carefully and move with better structure.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-cyan-600" />
                Compliance reminder
              </CardTitle>
              <CardDescription>
                VestBlock sells guidance, preparation, and support, not guarantees.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                VestBlock provides education, organization, and funding strategy tools. Approval
                decisions, credit limits, APRs, and terms are made by the issuer or lender. Only
                submit truthful, accurate, and documentable information.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
                  <Link href="/services">Compare All Services</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/services/financial-growth">Request Paid Review</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
