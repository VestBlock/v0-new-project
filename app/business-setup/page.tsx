import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  businessSetupServiceSteps,
  fundingReadinessPillars,
} from '@/lib/business-readiness/fundingCompliance';

export const metadata: Metadata = {
  title: 'Business Setup For Funding And Grants | VestBlock',
  description:
    'Prepare your business for funding, grants, business credit, and lender review with VestBlock business setup tools.',
  alternates: {
    canonical: '/business-setup',
    languages: {
      es: '/es/vestblock',
    },
  },
};

const nextSteps = [
  {
    title: 'Build business credit',
    description:
      'Turn your business profile into a vendor, monitoring, card, and lender roadmap.',
    href: '/tools/business-credit',
    cta: 'Open business credit tool',
  },
  {
    title: 'Find grant opportunities',
    description:
      'Match your business profile to grant programs and draft a stronger application letter.',
    href: '/tools/grants',
    cta: 'Open grants tool',
  },
  {
    title: 'Explore funding options',
    description:
      'Review funding options based on credit, revenue, documents, and business stage.',
    href: '/funding',
    cta: 'Run free funding check',
  },
  {
    title: 'Spanish funding support',
    description:
      'Send Spanish-speaking business owners to the dedicated funding page with Bank Breezy.',
    href: '/es/vestblock',
    cta: 'Ver pagina en espanol',
  },
];

export default function BusinessSetupPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b">
        <div className="container mx-auto grid max-w-6xl gap-8 px-4 pb-14 pt-24 md:grid-cols-[1.25fr_0.75fr] md:pt-28">
          <div>
            <Badge variant="outline" className="mb-4">
              Funding and grants preparation
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              Set up your business before you apply for funding.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              VestBlock helps business owners organize the legal, banking,
              credit, document, and grant-prep pieces lenders and programs
              usually review. The goal is a cleaner application file, not false
              promises or random applications.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/funding">
                  Check funding readiness <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing#funding-assistant-plans">See paid prep options</Link>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-500" />
                What VestBlock helps organize
              </CardTitle>
              <CardDescription>
                Practical setup help for businesses that want to apply with a cleaner file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {businessSetupServiceSteps.map((step) => (
                <div key={step} className="flex gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
                  <span>{step}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-12">
        <div className="mb-7 max-w-2xl">
          <h2 className="text-2xl font-semibold">
            Funding and grant compliance checklist
          </h2>
          <p className="mt-2 text-muted-foreground">
            These are the core areas VestBlock uses to prepare a business before
            business credit, funding, or grant applications.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {fundingReadinessPillars.map((pillar) => (
            <Card key={pillar.id}>
              <CardHeader>
                <CardTitle className="text-lg">{pillar.title}</CardTitle>
                <CardDescription>{pillar.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pillar.checks.map((check) => (
                  <div key={check} className="flex gap-3 text-sm">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{check}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="container mx-auto max-w-6xl px-4 py-12">
          <div className="mb-7 max-w-2xl">
            <h2 className="text-2xl font-semibold">Choose the next action</h2>
            <p className="mt-2 text-muted-foreground">
              Use the right VestBlock tool for the stage your business is in
              today.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {nextSteps.map((step) => (
              <Card key={step.href}>
                <CardHeader>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link href={step.href}>
                      {step.cta} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
            VestBlock does not guarantee grant awards, loan approvals, credit
            line approvals, or specific funding terms. We help organize the
            preparation work so owners can apply with clearer information and
            better documentation.
          </p>
        </div>
      </section>
    </main>
  );
}
