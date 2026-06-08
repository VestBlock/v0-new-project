import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  FileCheck2,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
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

export const metadata: Metadata = {
  title: 'DealFlow Growth Support | VestBlock Real Estate Deal Support',
  description:
    'VestBlock DealFlow Growth Support combines seller intake, buyer and lender fit review, DealVault records, response support, and follow-through support for real estate operators.',
  alternates: {
    canonical: '/dealflow-growth-system',
  },
  openGraph: {
    title: 'DealFlow Growth Support | VestBlock',
    description:
      'High-touch support for real estate teams that need cleaner intake, partner fit review, deal records, and lead response.',
    url: absoluteUrl('/dealflow-growth-system'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock DealFlow Growth Support preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DealFlow Growth Support | VestBlock',
    description:
      'Seller intake, buyer and lender fit review, DealVault records, AI response, and follow-through support for real estate operators.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

const systemModules = [
  {
    title: 'Seller intake path',
    body: 'Property details, seller motivation, timing, condition notes, and follow-up context move into a cleaner review path.',
    icon: Building2,
  },
  {
    title: 'Trust snapshots and verified criteria',
    body: 'Buy boxes, capital appetite, markets, proof-of-funds status, lending criteria, freshness, and missing info become easier to review.',
    icon: Network,
  },
  {
    title: 'DealVault records',
    body: 'Qualified deals can move into agreement records, payout splits, verification certificates, and milestone tracking.',
    icon: ShieldCheck,
  },
  {
    title: 'Response and follow-through support',
    body: 'AI reception, booking paths, and cleaner operating support help real estate demand move without becoming separate priorities.',
    icon: Sparkles,
  },
] as const;

const proofAssets = [
  {
    title: 'Seller intake summary',
    body: 'A clean view of property type, urgency, condition, asking price, equity clues, and recommended follow-up.',
  },
  {
    title: 'Deal Trust Snapshot',
    body: 'Criteria, proof status, relationship stage, missing information, freshness, and recommended next step.',
  },
  {
    title: 'Verified Buy Box',
    body: 'Markets, asset appetite, minimum margin, close speed, proof-of-funds status, and last-confirmed criteria.',
  },
  {
    title: 'DealVault record',
    body: 'Agreement details, payout terms, milestone history, certificate-ready activity, and private-file safeguards.',
  },
] as const;

const rolloutSteps = [
  {
    step: '01',
    title: 'Map the current deal flow',
    body: 'Review how seller leads, buyer contacts, lender contacts, partner notes, and follow-up currently move through the business.',
  },
  {
    step: '02',
    title: 'Build the intake and review process',
    body: 'Set up the seller path, buyer/lender criteria fields, lead triage rules, and human-reviewed outreach process.',
  },
  {
    step: '03',
    title: 'Add DealVault where accountability matters',
    body: 'Move qualified deals into clear records, payout visibility, milestone tracking, and demo-ready evidence.',
  },
  {
    step: '04',
    title: 'Support demand and retention',
    body: 'Use AI response, booking support, and monthly review to improve qualified demand and customer retention.',
  },
] as const;

const boardChecks = [
  'Built for operators with active deal flow or a clear plan to create it.',
  'Human-reviewed outreach until lead quality and deliverability are stable.',
  'No legal, title, escrow, brokerage, funding, closing, or revenue guarantees.',
  'Support services stay tied to real estate demand, partner quality, or DealVault retention.',
] as const;

export default function DealFlowGrowthSystemPage() {
  return (
    <main className="premium-page px-4 py-24">
      <div className="container mx-auto max-w-7xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-cyan-600 text-white">Premium support</Badge>
              <Badge variant="outline">Real estate focus</Badge>
              <Badge variant="outline">Real estate operators</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-5xl text-4xl font-bold tracking-tight md:text-6xl">
                DealFlow Growth Support for real estate teams ready to handle more opportunities.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                VestBlock combines seller intake, buyer and lender fit review, DealVault records,
                AI response, and follow-through support into one high-touch service for serious
                real estate operators.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="/get-started">
                  Request DealFlow Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/proof">View Proof Assets</Link>
              </Button>
            </div>
          </div>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                <BadgeDollarSign className="h-5 w-5" />
              </div>
              <CardTitle>Scale package</CardTitle>
              <CardDescription>
                Built for recurring revenue and higher-ticket implementation, not one-off lead forms.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-4xl font-bold">$2,500 setup + $997/mo</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Final scope is confirmed after review. Custom pricing applies for larger partner
                  networks, complex integrations, or higher-touch operations support.
                </p>
              </div>
              <div className="space-y-3 text-sm text-muted-foreground">
                {[
                  'Seller and funding intake path',
                  'Deal Trust Snapshot structure',
                  'Verified buy-box and lender-fit criteria',
                  'DealVault rollout guidance',
                  'AI response and booking support',
                  'Follow-through support tied to real estate demand',
                ].map((item) => (
                  <div key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="buyer-network" className="scroll-mt-24 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {systemModules.map((module) => {
            const Icon = module.icon;

            return (
              <Card key={module.title} className="premium-card">
                <CardHeader>
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{module.title}</CardTitle>
                  <CardDescription>{module.body}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-8 lg:grid-cols-[.92fr_1.08fr] lg:items-start">
          <div className="space-y-4">
            <Badge variant="outline">Deal records</Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Each review should create records that make the next deal easier.
            </h2>
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              Every lead and partner conversation should become a trust snapshot or verified criteria
              record. These records make outreach sharper, deal review faster, and DealVault easier
              to understand without pretending a young dataset has perfect scores.
            </p>
            <Button asChild variant="outline">
              <Link href="/proof">
                Open Record Library
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {proofAssets.map((asset) => (
              <Card key={asset.title} className="premium-card">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.05] text-cyan-300">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{asset.title}</CardTitle>
                  <CardDescription>{asset.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="premium-section p-6 md:p-8">
          <div className="mb-6 max-w-3xl">
            <Badge variant="outline">Implementation</Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">What gets built first</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The goal is a working revenue process: capture better opportunities, connect them to the
              right relationship, and use DealVault when records and accountability become valuable.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {rolloutSteps.map((step) => (
              <div key={step.step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm font-medium tracking-[0.22em] text-cyan-300">{step.step}</p>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                <Target className="h-5 w-5" />
              </div>
              <CardTitle>Best fit</CardTitle>
              <CardDescription>
                This is for teams that can benefit from structured deal support, not casual visitors.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {[
                'Wholesalers and disposition teams with repeat buyer conversations',
                'Investors or operators managing sellers, buyers, lenders, and partners',
                'Private lenders or capital partners who need cleaner borrower/deal fit',
                'Teams with referral payouts, JV splits, milestones, stale criteria, or proof requirements',
              ].map((item) => (
                <div key={item} className="flex gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="premium-card">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle>Service guardrails</CardTitle>
              <CardDescription>
                The service is built around better process and records, not promises.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {boardChecks.map((item) => (
                <div key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="premium-section p-8 text-center md:p-10">
          <Badge variant="outline">Next step</Badge>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">
            Build the process around the deals you actually want more of.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            Start with a review of your current intake, buyer/lender relationships, and deal proof needs.
            Then decide whether DealVault alone or the full DealFlow Growth Support package is the right next step.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
              <Link href="/get-started">
                Request DealFlow Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">Compare Pricing</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
