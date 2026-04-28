import Link from 'next/link';
import type { Metadata } from 'next';
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
import { absoluteUrl } from '@/lib/seo/site';
import {
  financialGrowthFaqJsonLd,
  financialGrowthServiceJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'Financial Growth Services For Funding, Credit, Grants, and Real Estate',
  description:
    'Paid VestBlock financial prep packages for funding readiness, business credit, grant applications, debt utilization, cash-flow document review, and real estate deal funding review.',
  alternates: {
    canonical: '/services/financial-growth',
  },
  openGraph: {
    title: 'VestBlock Financial Growth Services',
    description:
      'Request paid financial prep packages for business funding readiness, business credit, grant applications, utilization planning, cash-flow review, and real estate funding readiness.',
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
              Monetized financial services
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              Paid financial prep services for credit, funding, grants, and deal readiness.
            </h1>
            <p className="max-w-3xl text-lg text-muted-foreground">
              These packages give clients a clear paid next step when they need
              more than a free checker. Each service creates a real lead for
              VestBlock follow-up and keeps the work compliance-safe.
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
                How VestBlock monetizes this safely
              </CardTitle>
              <CardDescription>
                Free tools diagnose the path. Paid services organize documents,
                readiness, and follow-up. Approval promises stay out of the offer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Use these as manually fulfilled service packages first.</p>
              <p>Route qualified funding clients into the $300 readiness plan.</p>
              <p>Keep admin notes, source path, service package, and follow-up tasks attached to every request.</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {financialSkillsetPackages.map((servicePackage) => {
            const Icon =
              iconByPackage[servicePackage.key as keyof typeof iconByPackage] ??
              ClipboardCheck;

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
                  <Button asChild className="mt-auto">
                    <a href="#request-service">Request This Service</a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle>Recommended offer ladder</CardTitle>
              <CardDescription>
                Keep the buying path simple so clients understand what to do next.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-medium">Free</p>
                <p className="text-muted-foreground">
                  Funding checker, service directory, learning pages, and basic
                  readiness education.
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
                <p className="font-medium">$300 readiness plan plus success fee</p>
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

          <FinancialServiceInterestForm />
        </section>
      </div>
    </main>
  );
}
