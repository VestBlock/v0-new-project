import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Briefcase,
  BadgeDollarSign,
  Building2,
  CreditCard,
  FileText,
  Home,
  Landmark,
  Languages,
  Search,
  ShieldCheck,
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

const growthOfferKeys = ['visibility_expansion', 'ai_assistant'] as const;
const fundingSupportKeys = [
  'business_funding',
  'credit_card_stacking',
  'business_setup',
  'financial_growth_services',
  'grants',
  'spanish_funding',
] as const;
const dealFlowKeys = ['real_estate_funding', 'sell_property'] as const;
const optionalSupportKeys = ['credit_analysis'] as const;

function getServicesByKeys(keys: readonly string[]) {
  return keys
    .map((key) => vestBlockServiceDirectory.find((service) => service.key === key))
    .filter((service): service is (typeof vestBlockServiceDirectory)[number] => Boolean(service));
}

export const metadata: Metadata = {
  title: 'VestBlock Services',
  description:
    'Compare VestBlock services for DealVault, Search Visibility, AI Receptionist, funding preparation, and optional support.',
  alternates: {
    canonical: '/services',
  },
  openGraph: {
    title: 'VestBlock Services',
    description:
      'Find the right VestBlock service for DealVault, search visibility, AI Receptionist, funding preparation, and optional support.',
    url: absoluteUrl('/services'),
  },
};

const iconByService: Record<string, typeof CreditCard> = {
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
  paid_plan: 'Paid plan',
  lead_followup: 'Lead follow-up',
  member_tool: 'Member tool',
};

function getNextStepCopy(service: (typeof vestBlockServiceDirectory)[number]) {
  if (service.key === 'visibility_expansion' || service.key === 'ai_assistant') {
    return 'Preview the offer, submit the request, and keep your recommendations and follow-up tied to one account.';
  }

  if (service.key === 'real_estate_funding' || service.key === 'sell_property') {
    return 'Share the property or deal details first, then VestBlock can recommend the right follow-up or review option.';
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
  const growthOffers = getServicesByKeys(growthOfferKeys);
  const fundingSupport = getServicesByKeys(fundingSupportKeys);
  const dealFlowServices = getServicesByKeys(dealFlowKeys);
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
              Choose the service that matches what you need right now.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              DealVault helps teams keep better records. Visibility helps customers find you. AI Receptionist helps you respond faster.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="/dealvault/demo">
                  See DealVault Demo
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
                Start with the clearest option, then add deeper support only when you need it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">1. Pick the main service</p>
                <p>DealVault, Visibility Expansion, and AI Receptionist are the clearest entry points for most customers.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">2. Review the offer and pricing</p>
                <p>Most buyers want proof, pricing, and a clean next step before they look at anything more complicated.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                <p className="font-medium text-foreground">3. Add help when it matters</p>
                <p>Paid reviews, setup support, and specialist follow-up are there when the work needs more hands-on help.</p>
              </div>
            </CardContent>
          </Card>
        </section>
        </MarketingReveal>

        <section className="grid gap-3 md:grid-cols-4">
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">Growth services</CardTitle>
              <CardDescription>
                Best for service businesses that need better search presence or faster response.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">Funding support</CardTitle>
              <CardDescription>
                Best for owners checking whether they are ready, preparing documents, and choosing between a free check and paid support.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="premium-card">
            <CardHeader>
              <CardTitle className="text-lg">Deal flow and seller routes</CardTitle>
              <CardDescription>
                Best for buyers, lenders, and sellers who need a clear starting point around property opportunities and funding.
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
            <Badge variant="outline">Primary products</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Growth services for small businesses</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              These are the clearest starting points today for service businesses.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {growthOffers.map(renderServiceCard)}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <Badge variant="outline">Business support</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Funding prep and business support</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Use these when the priority is funding preparation, business setup, or guided financial support rather than demand generation.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {fundingSupport.map(renderServiceCard)}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <Badge variant="outline">Buyer, lender, and seller routes</Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Property and funding requests</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              These pages stay visible so real-estate partners and sellers still feel like they are in the right place without taking over the rest of the site.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {dealFlowServices.map(renderServiceCard)}
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
