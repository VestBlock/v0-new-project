import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Bot,
  Briefcase,
  BadgeDollarSign,
  Building2,
  CreditCard,
  FileText,
  Home,
  Landmark,
  Languages,
  Network,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { absoluteUrl } from '@/lib/seo/site';
import { serviceSeoPages } from '@/lib/seo/serviceSeoPages';
import { servicesItemListJsonLd } from '@/lib/seo/structuredData';
import {
  vestBlockServiceDirectory,
} from '@/lib/services/serviceDirectory';
import { MarketingReveal } from '@/components/marketing/reveal';
import { RevenuePathLinks } from '@/components/marketing/revenue-path-links';

const primaryOfferKeys = ['dealflow_growth_system', 'dealvault', 'sell_property', 'real_estate_funding'] as const;
const fundingSupportKeys = [
  'business_funding',
  'credit_card_stacking',
  'business_setup',
  'financial_growth_services',
  'grants',
  'spanish_funding',
] as const;
const growthSupportKeys = ['visibility_expansion', 'ai_assistant'] as const;
const optionalSupportKeys = ['credit_analysis'] as const;

function getServicesByKeys(keys: readonly string[]) {
  return keys
    .map((key) => vestBlockServiceDirectory.find((service) => service.key === key))
    .filter((service): service is (typeof vestBlockServiceDirectory)[number] => Boolean(service));
}

export const metadata: Metadata = {
  title: 'VestBlock Services',
  description:
    'Compare VestBlock services for seller property review, buyer and lender routing, developer and contractor partners, DealVault records, funding review, and member visibility support.',
  alternates: {
    canonical: '/services',
  },
  openGraph: {
    title: 'VestBlock Services',
    description:
      'Find the right VestBlock service for seller property review, buyer and lender routing, developer and contractor partners, DealVault records, funding review, and member visibility support.',
    url: absoluteUrl('/services'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock services preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VestBlock Services',
    description:
      'Find the right VestBlock service for seller property review, buyer and lender routing, developer and contractor partners, DealVault records, funding review, and member visibility support.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

const iconByService: Record<string, typeof CreditCard> = {
  dealvault: Blocks,
  dealflow_growth_system: Network,
  credit_analysis: CreditCard,
  business_funding: Briefcase,
  credit_card_stacking: CreditCard,
  business_setup: BadgeCheck,
  financial_growth_services: BadgeDollarSign,
  grants: FileText,
  spanish_funding: Languages,
  real_estate_funding: Building2,
  sell_property: Home,
  ai_assistant: Bot,
  visibility_expansion: Search,
};

const serviceStageLabels = {
  free_check: 'Free first step',
  paid_plan: 'Paid service',
  lead_followup: 'Request review',
  member_tool: 'Optional tool',
};

const intakePathCards = [
  {
    title: 'Sellers',
    body: 'Submit a property, timeline, condition, price, and seller situation for review.',
    href: '/sell',
    cta: 'Submit property',
    icon: Home,
  },
  {
    title: 'Buyers',
    body: 'Share markets, asset types, price range, proof status, and no-go items.',
    href: '/buyers',
    cta: 'Share buy box',
    icon: Users,
  },
  {
    title: 'Lenders',
    body: 'Share lending box, states, loan range, borrower fit, and deal criteria.',
    href: '/lenders',
    cta: 'Join network',
    icon: Landmark,
  },
  {
    title: 'Deal teams',
    body: 'Review DealVault, payout records, milestones, and proof-ready operating assets.',
    href: '/dealvault/demo',
    cta: 'View demo',
    icon: ShieldCheck,
  },
] as const;

function getNextStepCopy(service: (typeof vestBlockServiceDirectory)[number]) {
  if (service.key === 'dealvault') {
    return 'Review the demo, request the private walkthrough, and let VestBlock qualify the next step with your team.';
  }

  if (service.key === 'real_estate_funding' || service.key === 'sell_property') {
    return 'Share the property, funding, or deal details first, then VestBlock can recommend the right buyer, lender, or review path.';
  }

  if (service.key === 'visibility_expansion' || service.key === 'ai_assistant') {
    return 'Use this as a support layer when a real estate team needs stronger visibility, response speed, or lead capture.';
  }

  if (service.serviceStage === 'free_check') {
    return 'Start with a free check, then move into a paid service only if the business needs more help.';
  }

  if (service.serviceStage === 'member_tool') {
    return 'Use the tool directly, save the output, and ask for help only when the result shows a blocker.';
  }

  if (service.serviceStage === 'paid_plan') {
    return 'This is a paid review service for clients who already know they need more than a free checker.';
  }

  return 'Submit the details so VestBlock can review the request and recommend the next step.';
}

export default function ServicesPage() {
  const primaryOffers = getServicesByKeys(primaryOfferKeys);
  const fundingSupport = getServicesByKeys(fundingSupportKeys);
  const growthSupport = getServicesByKeys(growthSupportKeys);
  const optionalSupport = getServicesByKeys(optionalSupportKeys);

  const renderServiceCard = (service: (typeof vestBlockServiceDirectory)[number]) => {
    const Icon = iconByService[service.key] ?? Landmark;

    return (
      <Card
        key={service.key}
        id={service.key}
        className="premium-card flex h-full flex-col border-2 border-transparent hover:border-cyan-500/40"
      >
        <CardHeader>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
              <Icon className="h-5 w-5" />
            </div>
            <Badge variant="outline">
              {serviceStageLabels[service.serviceStage]}
            </Badge>
          </div>
          <CardTitle className="text-xl">{service.title}</CardTitle>
          <CardDescription>{service.summary}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Best for</p>
              <p className="text-muted-foreground">{service.bestFor}</p>
            </div>
            <div>
              <p className="font-medium">Pricing</p>
              <p className="text-muted-foreground">{service.priceNote}</p>
            </div>
            <div>
              <p className="font-medium">What happens next</p>
              <p className="text-muted-foreground">
                {getNextStepCopy(service)}
              </p>
            </div>
            <div>
              <p className="font-medium">Trust guardrail</p>
              <p className="text-muted-foreground">{service.trustNote}</p>
            </div>
          </div>

          <div className="mt-auto grid gap-2">
            <Button asChild>
              <Link href={service.route}>
                {service.primaryCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {service.secondaryRoute && service.secondaryCta && (
              <Button asChild variant="outline">
                {service.secondaryRoute.startsWith('http') ? (
                  <a
                    href={service.secondaryRoute}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {service.secondaryCta}
                  </a>
                ) : (
                  <Link href={service.secondaryRoute}>
                    {service.secondaryCta}
                  </Link>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <main className="premium-page px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(servicesItemListJsonLd()),
        }}
      />
      <div className="container mx-auto max-w-7xl space-y-12">
        <MarketingReveal>
        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit bg-cyan-600 text-white">Services</Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              Choose the real estate path that matches the deal in front of you.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Start with seller intake, buyer criteria, lender criteria, project partner fit, real estate funding review, or DealVault. SEO/AEO visibility, AI intake, funding prep, and credit support stay available when they support the deal.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="/get-started">
                  Choose Path
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-600" />
                A simpler way to choose
              </CardTitle>
              <CardDescription>
                Start with the real estate action, then add deeper support only when the deal needs it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">1. Pick the main service</p>
                <p>DealFlow Growth Support, DealVault, Seller Property Review, Buyer/Lender Routing, and Real Estate Funding are the clearest entry points for serious real estate conversations.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">2. Review the offer and pricing</p>
                <p>Most buyers want proof, pricing, and a clean next step before they look at anything more complicated.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">3. Add help when it matters</p>
                <p>SEO/AEO visibility, AI intake, paid reviews, setup support, and specialist follow-up are there when the deal or network member needs more hands-on help.</p>
              </div>
            </CardContent>
          </Card>
        </section>
        </MarketingReveal>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {intakePathCards.map((path) => {
            const Icon = path.icon;

            return (
              <Link
                key={path.title}
                href={path.href}
                className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-cyan-300/40 hover:shadow-[0_18px_42px_rgba(8,145,178,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-lg font-semibold">{path.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{path.body}</p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-cyan-200">
                  {path.cta}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </section>

        <RevenuePathLinks
          eyebrow="Compare the proof"
          title="The strongest pages are now one click from services."
          description="If a buyer, seller, or lender wants evidence before choosing a service, send them to the property review path, real estate funding page, DealVault demo, or live proof records."
        />

        <section className="grid gap-3 md:grid-cols-4">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">Best first offers</CardTitle>
              <CardDescription>
                Best for sellers, buyers, lenders, and operators choosing the right real estate path first.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">Growth support</CardTitle>
              <CardDescription>
                Best when a real estate operator needs better visibility, response speed, or lead capture around active deal flow.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">Funding and prep support</CardTitle>
              <CardDescription>
                Best when a deal or business file needs cleaner documents, eligibility review, or paid preparation.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">Optional credit support</CardTitle>
              <CardDescription>
                Best for customers who truly need report cleanup or dispute support after they already know they need it.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="space-y-6">
          <div>
            <Badge variant="outline">Main products</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Real estate paths to start with</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              These are the primary VestBlock entry points: DealFlow Growth Support, DealVault records, seller opportunities, buyer/lender fit review, and project partner routing.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {primaryOffers.map(renderServiceCard)}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <Badge variant="outline">Growth support</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Visibility and response support</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Use these when a real estate operator, lender, buyer, developer, or contractor needs stronger search presence, faster intake, booking support, or a cleaner website experience.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {growthSupport.map(renderServiceCard)}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <Badge variant="outline">Funding and prep support</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Business funding, setup, and prep reviews</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Use these when the priority is funding preparation, business setup, Spanish-language funding help, grants, or guided financial support.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {fundingSupport.map(renderServiceCard)}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <Badge variant="outline">Optional support</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Credit cleanup and report tools</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Credit help is still available when it is needed, but it no longer has to compete with the main product story.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {optionalSupport.map(renderServiceCard)}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <Badge variant="outline">Service guides</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              Published guides for every VestBlock service
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              These pages explain each service in plain language for clients and search engines. They are useful links for social posts, articles, and follow-up emails.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {serviceSeoPages.map((page) => (
              <Link
                key={page.slug}
                href={`/services/${page.slug}`}
                className="premium-link-card p-4"
              >
                <p className="font-semibold">{page.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{page.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
