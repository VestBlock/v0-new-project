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
import { RevenuePathLinks } from '@/components/marketing/revenue-path-links';
import { FaqSection } from '@/components/marketing/faq-section';
import { faqPageJsonLd, breadcrumbJsonLd } from '@/lib/seo/structuredData';
import { pricingFaqs } from '@/lib/seo/faqContent';

export const metadata: Metadata = {
  title: 'VestBlock Real Estate Deal Pricing',
  description:
    'Compare VestBlock pricing and starting points for seller property review, real estate funding review, DealVault, and supporting services.',
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'VestBlock Real Estate Deal Pricing',
    description:
      'See VestBlock pricing and starting points for seller property review, real estate funding review, DealVault, and support services.',
    url: absoluteUrl('/pricing'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock pricing preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VestBlock Real Estate Deal Pricing',
    description:
      'See VestBlock pricing and starting points for seller property review, real estate funding review, DealVault, and support services.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

const freeStartingPoints = vestBlockServiceDirectory.filter((service) => service.serviceStage === 'free_check');
const leadReviewStartingPoints = vestBlockServiceDirectory.filter(
  (service) => service.serviceStage === 'lead_followup'
);

const featuredPaidOfferKeys = [
  'dealflow_growth_system',
  'real_estate_funding',
  'dealvault',
] as const;

const featuredPaidOffers = featuredPaidOfferKeys
  .map((key) => vestBlockServiceDirectory.find((service) => service.key === key))
  .filter((service): service is (typeof vestBlockServiceDirectory)[number] => Boolean(service));

const highlightPackages = pricedVestBlockOffers.filter((offer) =>
  [
    'funding_readiness_snapshot',
    'debt_utilization_plan',
    'business_credit_builder_sprint',
    'real_estate_deal_review',
  ].includes(offer.key)
);

const publicFundingPlanIds = new Set(['assisted_funding_package', 'custom_plan']);
const fundingPlans = getFundingPaymentPlans().plans.filter((plan) =>
  publicFundingPlanIds.has(plan.id)
);
const growthAutomationOffers = pricedVestBlockOffers.filter(
  (offer) => offer.category === 'growth_automation'
);
const fundingPlanOfferByKey = Object.fromEntries(
  pricedVestBlockOffers
    .filter((offer) => offer.category === 'funding_assistant')
    .map((offer) => [offer.key, offer])
);

const scaleRevenuePlans = [
  {
    name: 'DealVault Team',
    price: '$297/mo',
    audience: 'Active operators with partners, buyers, sellers, vendors, or referral payouts to track.',
    route: '/dealvault/demo',
    cta: 'Request Demo',
    points: [
      'Recurring proof and payout records',
      'Milestone tracking for active deals',
      'Team rollout support',
    ],
  },
  {
    name: 'DealFlow Growth Support',
    price: '$2,500 setup + $997/mo',
    audience: 'Operators who need seller intake, buyer and lender criteria review, AI response, and follow-through working together.',
    route: '/dealflow-growth-system',
    cta: 'View Support',
    points: [
      'Seller and funding intake path',
      'AI receptionist and booking support',
      'Follow-through support tied to real estate demand',
    ],
  },
  {
    name: 'Buyer/Lender Network Buildout',
    price: 'Custom',
    audience: 'Teams building a structured buyer, lender, title, escrow, and partner database around repeat deal flow.',
    route: '/real-estate-funding',
    cta: 'Discuss Network',
    points: [
      'Buy-box and lender criteria structure',
      'Partner relationship stage tracking',
      'Manual-approved outreach process',
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <main className="premium-page px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            faqPageJsonLd(pricingFaqs),
            breadcrumbJsonLd([
              { name: 'VestBlock', path: '/' },
              { name: 'Pricing', path: '/pricing' },
            ]),
          ]),
        }}
      />
      <div className="container mx-auto max-w-7xl space-y-12">
        <MarketingReveal>
        <section className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit bg-cyan-600 text-white">Pricing</Badge>
            <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
              Pricing built around real estate deal movement.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Start with property review, real estate funding fit, or DealVault. Use AI reception, business funding prep, and credit support only when they help the deal move.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="/get-started">
                  Choose Path
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/services">Compare Services</Link>
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
                Choose the service that moves the real estate conversation first, then add support only when it helps the buyer, seller, lender, or operator move forward.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Seller Property Review and Real Estate Funding are the front-door routes for active deal conversations.</p>
              <p>DealVault is the premium product for teams that need agreement records, payout clarity, and milestone proof.</p>
              <p>AI Receptionist supports real estate teams that need better lead capture, booking, or response speed.</p>
              <p>Custom setup and deeper support are best handled after the property, buyer, lender, or funding goal is clear.</p>
            </CardContent>
          </Card>
        </section>
        </MarketingReveal>

        <section className="premium-section p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge variant="outline">Ready to talk</Badge>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">
                Start with the fastest revenue conversation.
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Pick the offer closest to the problem you want solved. These paths create a useful request without forcing a login first.
              </p>
            </div>
            <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
              <Link href="/get-started">
                Choose My Path
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                title: 'DealVault demo',
                body: 'Best when assignment records, payouts, approvals, or deal milestones need to be easier to prove.',
                href: '/dealvault/demo#dealvault-demo',
                cta: 'Request Demo',
              },
              {
                title: 'Seller property review',
                body: 'Best when a seller wants a property reviewed for fast cash, creative structure, or novation paths.',
                href: '/sell',
                cta: 'Submit Property',
              },
              {
                title: 'Buyer buy box',
                body: 'Best when an acquisition team wants seller opportunities routed by market, asset, price, and proof criteria.',
                href: '/buyers',
                cta: 'Share Buy Box',
              },
              {
                title: 'Lender network',
                body: 'Best when a lender wants routed real estate opportunities that match states, loan size, borrower fit, and no-go rules.',
                href: '/lenders',
                cta: 'Join Network',
              },
              {
                title: 'Real estate funding fit',
                body: 'Best when a DSCR, flip, rental, hard-money, or lender conversation needs better context.',
                href: '/real-estate-funding',
                cta: 'Submit Deal',
              },
              {
                title: 'Paid deal review',
                body: 'Best when an investor needs a sharper lender-facing review before a funding conversation.',
                href: '/services/financial-growth?package=real_estate_deal_review#request-service',
                cta: 'Request Review',
              },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-cyan-300/40 hover:shadow-[0_18px_42px_rgba(8,145,178,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <p className="font-semibold">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                <div className="mt-4 inline-flex items-center text-sm font-medium text-cyan-200">
                  {item.cta}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <RevenuePathLinks
          eyebrow="Proof before purchase"
          title="Give buyers the demo, proof, and setup pages before they decide."
          description="Pricing now links directly to the sales assets that answer the biggest deal questions: where the property starts, how funding fit is reviewed, what the DealVault demo looks like, and what support can be added."
        />

        <section className="space-y-5">
          <div className="max-w-3xl">
            <Badge variant="outline">Scale plans</Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Plans designed for recurring revenue, not one-off form submissions.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The clearest path is to turn active real estate operators into recurring DealVault customers, then add higher-touch support when a team needs intake, partner review, and network follow-up.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {scaleRevenuePlans.map((plan) => (
              <Card key={plan.name} className="premium-card flex h-full flex-col border-cyan-500/20">
                <CardHeader>
                  <Badge className="w-fit bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                    Primary focus
                  </Badge>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.audience}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-5">
                  <div>
                    <p className="text-3xl font-bold">{plan.price}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Final scope confirmed after review; no funding, revenue, closing, or approval guarantee.
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    <Button asChild className="w-full bg-cyan-600 hover:bg-cyan-700">
                      <Link href={plan.route}>
                        {plan.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle>Core real estate paths</CardTitle>
              <CardDescription>
                These are the main routes buyers, sellers, lenders, and operators should compare first.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_14px_38px_rgba(8,145,178,0.12)]">
                <p className="font-medium">Seller property review</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A direct route for sellers to submit a property for fast cash, creative structure, novation, or partner review.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link href="/sell">Submit Property</Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_14px_38px_rgba(8,145,178,0.12)]">
                <p className="font-medium">Real estate funding and buyer/lender routing</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review DSCR, rental, flip, hard-money, and partner details before routing the conversation.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link href="/real-estate-funding">Submit Deal</Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_14px_38px_rgba(8,145,178,0.12)]">
                <p className="font-medium">Buyer buy-box intake</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A dedicated route for buyers to share exactly what they want before seller opportunities are routed.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link href="/buyers">Share Buy Box</Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_14px_38px_rgba(8,145,178,0.12)]">
                <p className="font-medium">Lender network signup</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A dedicated route for lenders to share criteria so matching deals can be routed to the right team.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link href="/lenders">Join Network</Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-[0_14px_38px_rgba(8,145,178,0.12)]">
                <p className="font-medium">DealVault records</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Agreement records, proof certificates, payout tracking, and milestone history for deal-driven teams.
                </p>
                <div className="mt-3">
                  <Button asChild size="sm">
                    <Link href="/dealvault/demo">See Demo</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <CardTitle>Support services</CardTitle>
              <CardDescription>
                AI reception, credit cleanup, and deeper prep reviews stay available without taking over the main real estate product story.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>AI Receptionist is strongest as an add-on for investors, lenders, and real estate teams that need better lead capture or response speed.</p>
              <p>Business Funding Prep remains a clear paid review with a fixed upfront price when a business needs documents, profile cleanup, or timing guidance.</p>
              <p>Credit tools and higher-touch reviews remain available when the deal or file needs more hands-on work.</p>
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
              {leadReviewStartingPoints.slice(0, 2).map((service) => (
                <div key={service.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{service.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{service.priceNote}</p>
                    </div>
                    <Badge variant="outline">Lead review</Badge>
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
                These are the paid offers VestBlock should make easiest to compare and buy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {featuredPaidOffers.map((service) => (
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
                  Most real estate visitors should see Seller Property Review, Real Estate Funding, or DealVault first. Visibility, AI reception, credit tools, and custom review stay behind those core paths.
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


        <section id="funding-assistant-plans" className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Guided funding prep options</h2>
            <p className="max-w-3xl text-muted-foreground">
              Start with the free funding check, then move into a guided review only when the business needs more hands-on preparation before applying.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {fundingPlans.map((plan) => {
              const planOffer = fundingPlanOfferByKey[plan.id];

              return (
              <Card key={plan.id} className="premium-card flex h-full flex-col">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="outline">
                      {plan.id === 'custom_plan' ? 'Custom review' : 'Guided review'}
                    </Badge>
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
                        <Link href={planOffer.parentServiceRoute}>View Service</Link>
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
                VestBlock provides education, organization, and funding prep support. Approval
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

        <FaqSection items={pricingFaqs} title="Pricing FAQ" className="!px-0" />
      </div>
    </main>
  );
}
