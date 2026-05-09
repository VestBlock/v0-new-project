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
  financialGrowthFaqJsonLd,
  financialGrowthServiceJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'Financial Growth Services For Funding, Credit, Grants, and Real Estate',
  description:
    'Paid VestBlock financial prep packages for funding preparation, business credit, grant applications, debt utilization, cash-flow document review, and real estate deal funding review.',
  alternates: {
    canonical: '/services/financial-growth',
  },
  openGraph: {
    title: 'VestBlock Financial Growth Services',
    description:
      'Request paid financial prep packages for business funding preparation, business credit, grant applications, utilization planning, cash-flow review, and real estate funding preparation.',
    url: absoluteUrl('/services/financial-growth'),
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
  return (
    <main className="min-h-screen bg-background px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            financialGrowthServiceJsonLd(),
            financialGrowthFaqJsonLd(),
          ]),
        }}
      />
      <div className="container mx-auto max-w-7xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit bg-cyan-600 text-white">
              Paid financial services
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              Paid service hub for credit, funding, grants, and deal prep.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              Use this page when you want a clearly scoped paid review, document
              prep package, or guided next step after a free tool or funding
              check showed that more help is needed.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <a href="#request-service">
                  Request A Service
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/services">Compare All Services</Link>
              </Button>
            </div>
          </div>

          <Card className="border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-600" />
                How these services are structured
              </CardTitle>
              <CardDescription>
                Each package has a clear scope, price, and next step so clients know
                exactly what support they are requesting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Start with the package that matches your immediate goal.</p>
              <p>Use the service page to compare scope before requesting support.</p>
              <p>VestBlock keeps the offer focused on preparation, review, and guided next steps.</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">From funding</CardTitle>
              <CardDescription>
                Move here when documents, utilization, or application sequencing need manual cleanup.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">From credit repair</CardTitle>
              <CardDescription>
                Move here when the user needs more than a self-serve report analysis or dispute workflow.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">From grants</CardTitle>
              <CardDescription>
                Move here when grant fit is decent but the documents, narrative, or structure are still weak.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">From real estate</CardTitle>
              <CardDescription>
                Move here when a deal needs deeper review before the right lender or partner conversation.
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
                      <p className="font-medium">Next sale path</p>
                      <p className="text-muted-foreground">{servicePackage.upsellPath}</p>
                    </div>
                    <div>
                      <p className="font-medium">Guardrail</p>
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
                        Request This Service
                      </Link>
                    </Button>
                    {servicePackage.key === 'real_estate_deal_review' && (
                      <>
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
              <CardTitle>Simple pricing flow</CardTitle>
              <CardDescription>
                Keep the decision simple so clients understand what to do next.
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
                <p className="font-medium">$149-$300 one-time reviews</p>
                <p className="text-muted-foreground">
                  Paid snapshots for clients who need a professional review before
                  applying, disputing, or submitting a grant.
                </p>
              </div>
              <div>
                <p className="font-medium">$300 funding prep plan plus success fee</p>
                <p className="text-muted-foreground">
                  Deeper funding prep for business credit lines and business funding cases.
                </p>
              </div>
              <div>
                <p className="font-medium">$499 sprint</p>
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
                <CardTitle>When this page fits best</CardTitle>
                <CardDescription>
                  Choose this page when you want a defined paid review instead of a vague consultation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Choose this after a funding check shows the business needs cleanup before applying.</p>
                <p>Use it when a real-estate deal or grant opportunity needs a more manual review.</p>
                <p>Start here when you want a paid prep package with a clear scope and next step.</p>
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
