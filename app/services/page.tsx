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
import { servicesItemListJsonLd } from '@/lib/seo/structuredData';
import {
  serviceIntentLabels,
  vestBlockServiceDirectory,
  type VestBlockServiceIntent,
} from '@/lib/services/serviceDirectory';

export const metadata: Metadata = {
  title: 'VestBlock Services For Credit Repair, Funding, Grants, and Real Estate',
  description:
    'Compare VestBlock services for AI credit analysis, dispute letters, business funding eligibility, credit card stacking readiness, business setup, grants, Spanish funding, real estate funding, and property seller leads.',
  alternates: {
    canonical: '/services',
  },
  openGraph: {
    title: 'VestBlock Services',
    description:
      'Find the right VestBlock path for credit repair, business funding, grants, business credit, Spanish funding, real estate funding, and financial growth services.',
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
};

const serviceStageLabels = {
  free_check: 'Free first step',
  paid_plan: 'Paid plan',
  lead_followup: 'Lead follow-up',
  member_tool: 'Member tool',
};

const primaryIntents: VestBlockServiceIntent[] = [
  'get_business_funding',
  'repair_credit',
  'prepare_business',
  'find_grants',
  'fund_real_estate',
  'sell_property',
];

const primaryIntentAnchors: Record<VestBlockServiceIntent, string> = {
  repair_credit: 'credit_analysis',
  get_business_funding: 'business_funding',
  prepare_business: 'business_setup',
  find_grants: 'grants',
  fund_real_estate: 'real_estate_funding',
  sell_property: 'sell_property',
  automate_followup: 'ai_assistant',
};

export default function ServicesPage() {
  const sortedServices = [...vestBlockServiceDirectory].sort(
    (a, b) => a.priority - b.priority
  );

  return (
    <main className="min-h-screen bg-background px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(servicesItemListJsonLd()),
        }}
      />
      <div className="container mx-auto max-w-7xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit bg-cyan-600 text-white">VestBlock services</Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              Find the right path for credit, funding, grants, or property deals.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Start with the service that matches what you need today. VestBlock routes
              each request into the right tool, lead workflow, admin follow-up, or paid
              plan without making you guess where to go.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="/funding#free-eligibility-check">
                  Check Funding Eligibility Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/credit-upload">Analyze My Credit</Link>
              </Button>
            </div>
          </div>

          <Card className="border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-600" />
                Simple client routing
              </CardTitle>
              <CardDescription>
                Every service has a clear next action, an operator workflow, and a
                compliance-safe trust note.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {primaryIntents.map((intent) => (
                <a
                  key={intent}
                  href={`#${primaryIntentAnchors[intent]}`}
                  className="rounded-md border p-3 text-sm transition-colors hover:border-cyan-500/60 hover:bg-muted/60"
                >
                  {serviceIntentLabels[intent]}
                </a>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {sortedServices.map((service) => {
            const Icon = iconByService[service.key] ?? Landmark;

            return (
              <Card
                key={service.key}
                id={service.key}
                className="flex h-full flex-col border-2 border-transparent transition-colors hover:border-cyan-500/40"
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
                      <p className="font-medium">Pricing path</p>
                      <p className="text-muted-foreground">{service.priceNote}</p>
                    </div>
                    <div>
                      <p className="font-medium">Operator workflow</p>
                      <p className="text-muted-foreground">{service.operatorNote}</p>
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
          })}
        </section>
      </div>
    </main>
  );
}
