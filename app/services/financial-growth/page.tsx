import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { FinancialServiceInterestForm } from '@/components/financial-service-interest-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { financialSkillsetPackages } from '@/lib/services/financialSkillsets';
import { pricedVestBlockOffers } from '@/lib/services/pricedOffers';
import { absoluteUrl } from '@/lib/seo/site';
import { buildPartnerReferralPath } from '@/lib/partners/referrals';
import {
  breadcrumbJsonLd,
  financialGrowthFaqJsonLd,
  financialGrowthServiceJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'Funding & Business Credit Prep Reviews',
  description:
    'Request focused VestBlock prep reviews for funding readiness, business credit, grant applications, debt utilization, cash-flow documents, and real estate deal funding review.',
  alternates: {
    canonical: '/services/financial-growth',
  },
  openGraph: {
    title: 'VestBlock Funding & Business Credit Prep Reviews',
    description:
      'Request focused prep reviews for business funding, business credit, grants, utilization, cash-flow documents, and real estate funding preparation.',
    url: absoluteUrl('/services/financial-growth'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock funding prep reviews preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VestBlock Funding & Business Credit Prep Reviews',
    description:
      'Request focused prep reviews for business funding, business credit, grants, utilization, cash-flow documents, and real estate funding preparation.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

const iconByPackage = {
  funding_readiness_snapshot: ClipboardCheck,
  business_credit_builder_sprint: BriefcaseBusiness,
  grant_application_prep: FileText,
  debt_utilization_plan: BadgeDollarSign,
  cash_flow_document_review: Banknote,
  real_estate_deal_review: Building2,
};

const packageOfferByKey = Object.fromEntries(
  pricedVestBlockOffers
    .filter((offer) => offer.category === 'financial_growth')
    .map((offer) => [offer.key, offer])
);

export default function FinancialGrowthServicesPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'VestBlock', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Funding & Business Credit Prep Reviews', path: '/services/financial-growth' },
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbs,
            financialGrowthServiceJsonLd(),
            financialGrowthFaqJsonLd(),
          ]),
        }}
      />
      <div className="container mx-auto max-w-7xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit bg-cyan-600 text-white">
              Prep reviews
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              Funding and business credit prep reviews with a clear next step.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Choose a focused review when you need cleaner documents, better timing, or a practical plan before applying for funding, grants, business credit, or real estate financing.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <a href="#request-service">
                  Request Prep Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/services">Compare All Services</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Link href="/services/financial-growth-services" className="underline-offset-4 hover:underline">
                Read the prep reviews service guide
              </Link>
              <Link href="/services/business-funding-eligibility" className="underline-offset-4 hover:underline">
                Funding eligibility guide
              </Link>
            </div>
          </div>

          <Card className="border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-600" />
                How prep reviews work
              </CardTitle>
              <CardDescription>
                Each review has a clear scope, price range, and follow-up path. No payment is collected from this request form.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Start with the review that matches the immediate blocker.</p>
              <p>Tell us what you are trying to accomplish and what documents or timeline you already have.</p>
              <p>VestBlock confirms the right scope before any paid next step.</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Funding cleanup</CardTitle>
              <CardDescription>
                For owners who need documents, timing, or application sequence cleaned up before they apply.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Business credit profile</CardTitle>
              <CardDescription>
                For businesses that need a cleaner profile, vendor roadmap, or utilization plan before seeking credit.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Grant package prep</CardTitle>
              <CardDescription>
                For owners who found an opportunity but need a stronger story, checklist, and document package.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Real estate deal prep</CardTitle>
              <CardDescription>
                For investors who need deal details organized before a lender, broker, or partner conversation.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {financialSkillsetPackages.map((servicePackage) => {
            const Icon =
              iconByPackage[servicePackage.key as keyof typeof iconByPackage] ??
              ClipboardCheck;
            const packageOffer = packageOfferByKey[servicePackage.key];

            return (
              <Card key={servicePackage.key} className="flex h-full flex-col">
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline">{servicePackage.price}</Badge>
                  </div>
                  <CardTitle>{servicePackage.title}</CardTitle>
                  <CardDescription>{servicePackage.summary}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium">Best for</p>
                      <p className="text-muted-foreground">{servicePackage.bestFor}</p>
                    </div>
                    <div>
                      <p className="font-medium">Deliverables</p>
                      <ul className="mt-2 space-y-2 text-muted-foreground">
                        {servicePackage.deliverables.map((item) => (
                          <li key={item} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">Recommended next step</p>
                      <p className="text-muted-foreground">{servicePackage.upsellPath}</p>
                    </div>
                    <div>
                      <p className="font-medium">Important note</p>
                      <p className="text-muted-foreground">{servicePackage.complianceNote}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {packageOffer && (
                      <Button asChild>
                        <Link href={`/services/${packageOffer.slug}`}>View Service</Link>
                      </Button>
                    )}
                    <Button asChild variant="outline">
                      <Link href={`/services/financial-growth?package=${servicePackage.key}#request-service`}>
                        Request This Review
                      </Link>
                    </Button>
                    {servicePackage.key === 'real_estate_deal_review' && (
                      <>
                        <Button asChild variant="outline">
                          <Link
                            href={buildPartnerReferralPath({
                              partnerKey: 'nlc',
                              source: 'financial-growth-service',
                              service: 'real_estate_deal_review',
                              packageKey: servicePackage.key,
                            })}
                            target="_blank"
                            rel="noreferrer"
                          >
                            No Limit Capital Path
                          </Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link
                            href={buildPartnerReferralPath({
                              partnerKey: 'kiavi',
                              source: 'financial-growth-service',
                              service: 'real_estate_deal_review',
                              packageKey: servicePackage.key,
                            })}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Kiavi Partner Path
                          </Link>
                        </Button>
                        <Button asChild variant="outline">
                          <Link
                            href={buildPartnerReferralPath({
                              partnerKey: 'rcn',
                              source: 'financial-growth-service',
                              service: 'real_estate_deal_review',
                              packageKey: servicePackage.key,
                            })}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Broker Intake
                          </Link>
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section
          id="request-service"
          className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start"
        >
          <Card>
            <CardHeader>
              <CardTitle>Simple review path</CardTitle>
              <CardDescription>
                Keep the decision clear before a customer pays for deeper help.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Free</p>
                <p className="text-muted-foreground">
                  Funding checker, service directory, learning pages, and basic
                  preparation education.
                </p>
              </div>
              <div>
                <p className="font-medium">$149-$300 focused reviews</p>
                <p className="text-muted-foreground">
                  Focused reviews for owners who need a practical plan before applying, improving documents, or submitting a grant.
                </p>
              </div>
              <div>
                <p className="font-medium">$300 funding prep plan when hands-on help is needed</p>
                <p className="text-muted-foreground">
                  Guided funding prep for business credit lines and business funding cases that need closer review.
                </p>
              </div>
              <div>
                <p className="font-medium">$499 business credit sprint</p>
                <p className="text-muted-foreground">
                  Higher-touch business credit setup support for owners who need
                  structure before they can pursue larger funding paths.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-cyan-500/20">
              <CardHeader>
                <CardTitle>When this review path fits best</CardTitle>
                <CardDescription>
                  Choose this when you want a defined review instead of a vague consultation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Choose this after a funding check shows the business needs cleanup before applying.</p>
                <p>Use it when a real-estate deal or grant opportunity needs a more manual review.</p>
                <p>Start here when you want a prep review with a clear scope and next step before payment.</p>
              </CardContent>
            </Card>

            <Suspense fallback={<Card className="border-cyan-500/20"><CardContent className="p-6 text-sm text-muted-foreground">Loading service request form...</CardContent></Card>}>
              <FinancialServiceInterestForm />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
