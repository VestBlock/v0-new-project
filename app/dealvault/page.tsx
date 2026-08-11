import Link from 'next/link';
import type { Metadata } from 'next';
import Image from 'next/image';
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  CircleDollarSign,
  FileCheck,
  Landmark,
  Link2,
  Network,
  Presentation,
  ReceiptText,
  ShieldCheck,
  Sparkles,
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
import { DealVaultPilotInterestForm } from '@/components/dealvault/dealvault-pilot-interest-form';
import {
  dealVaultPublicContracts,
  dealVaultPublicDemo,
  shortenHex,
} from '@/lib/dealvault/contractMetadata';
import {
  breadcrumbJsonLd,
  dealVaultFaqJsonLd,
  dealVaultServiceJsonLd,
} from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'DealVault By VestBlock | Premium Proof, Payout, and Milestone Tracking',
  description:
    'DealVault by VestBlock gives teams cleaner agreement records, payout tracking, and milestone audit trails with live blockchain proof records behind them.',
  alternates: {
    canonical: '/dealvault',
  },
  keywords: [
    'smart agreement tracking',
    'blockchain proof records',
    'payout ledger software',
    'milestone audit trail',
    'referral payout tracking',
    'contractor milestone tracking',
    'DealVault by VestBlock',
  ],
  openGraph: {
    title: 'DealVault By VestBlock',
    description:
      'Cleaner proof records, payout ledgers, and milestone audit trails for serious deal-driven teams.',
    url: absoluteUrl('/dealvault'),
    images: [
      {
        url: absoluteUrl('/dealvault/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'DealVault by VestBlock preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DealVault By VestBlock',
    description:
      'Cleaner proof records, payout ledgers, and milestone audit trails for serious deal-driven teams.',
    images: [absoluteUrl('/dealvault/opengraph-image')],
  },
};

const primaryModules = [
  {
    title: 'Proof records',
    description:
      'Create document proof records and timestamps without storing raw contracts or sensitive property details on-chain.',
    icon: FileCheck,
  },
  {
    title: 'Payout ledger',
    description:
      'Track referral, partner, and split-based payouts in a transparent ledger before money movement becomes a dispute problem.',
    icon: ReceiptText,
  },
  {
    title: 'Milestone audit trail',
    description:
      'Track project milestones with proof submissions, approvals, disputes, and completion history.',
    icon: Blocks,
  },
];

const trustPoints = [
  'Live on Polygon mainnet',
  'Private documents stay off-chain',
  'No wallet connect required for normal users',
  'Transparent event records with public explorer links',
];

const useCases = [
  'Real estate agreement proof and partner split tracking',
  'Private lending and referral payout accountability',
  'Contractor and field-service milestone approvals',
  'Agency, consulting, and client-deliverable milestone records',
  'Creative finance and custom agreement proof timelines',
  'Staffing, recruiting, and placement-fee trail support',
];

const processSteps = [
  {
    title: 'Track the agreement',
    body: 'Create a deal record, anchor proof metadata, and keep sensitive documents off-chain.',
  },
  {
    title: 'Lock the payout logic',
    body: 'Record referral, partner, and split-based payout terms in a transparent ledger.',
  },
  {
    title: 'Manage the project trail',
    body: 'Capture milestone submissions, approvals, disputes, and completions in one clear audit trail.',
  },
];

const pricingTiers = [
  {
    title: 'Solo Investor',
    price: '$97/mo',
    description: 'For individuals who need proof records and cleaner accountability.',
    bullets: [
      'Core proof and agreement tracking',
      'Referral and JV payout ledger support',
      'Milestone tracking for active projects',
      'Pilot onboarding and product support',
    ],
    emphasis: false,
  },
  {
    title: 'Team',
    price: '$297/mo',
    description: 'For active teams with multiple partners, vendors, or milestone owners around the same work.',
    bullets: [
      'Everything in Solo Investor',
      'Multi-user access and support',
      'Higher-touch rollout and usage guidance',
      'Built for deal teams, service firms, and partner-heavy businesses',
    ],
    emphasis: true,
  },
  {
    title: 'Business',
    price: '$997/mo',
    description: 'For serious businesses that want DealVault as a premium record and accountability product.',
    bullets: [
      'Everything in Team',
      'Deeper rollout support and custom setup planning',
      'Priority support',
      'Best for higher-volume firms and partner networks',
    ],
    emphasis: false,
  },
];

const faqItems = [
  {
    question: 'What does DealVault store on-chain?',
    answer:
      'DealVault stores hashes, proof IDs, timestamps, statuses, and opaque record references on-chain. Sensitive documents, names, and raw property details stay off-chain.',
  },
  {
    question: 'Does DealVault replace escrow, title, or legal counsel?',
    answer:
      'No. DealVault helps track and prove agreement records. It does not replace legal counsel, licensed title services, escrow, brokerage compliance, or required real estate professionals.',
  },
  {
    question: 'Who should look at DealVault first?',
    answer:
      'The strongest early users are real estate teams, private lenders, contractors, agencies, consulting groups, staffing businesses, and referral-heavy companies that need a stronger proof and payout trail.',
  },
];

export default function DealVaultLandingPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'VestBlock', path: '/' },
    { name: 'DealVault', path: '/dealvault' },
  ]);

  return (
    <main className="vb-page overflow-x-clip px-4 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([breadcrumbs, dealVaultServiceJsonLd(), dealVaultFaqJsonLd()]),
        }}
      />

      <div className="container mx-auto min-w-0 max-w-6xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.08fr_.92fr] lg:items-start">
          <div className="space-y-6">
            <p className="vb-eyebrow">DealVault · live on {dealVaultPublicDemo.network}</p>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-medium tracking-tight md:text-6xl">
                Cleaner records for deals, payouts, and milestones.
              </h1>
              <p className="max-w-3xl text-lg text-muted-foreground">
                DealVault by VestBlock is built for teams that have already outgrown scattered PDFs,
                text threads, and spreadsheet memory. It gives real estate teams, private lenders,
                contractors, agencies, staffing groups, and referral partners a cleaner audit trail
                around agreements, payout logic, and project milestones.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-[#b7ff3c] hover:bg-[#a8f52a]">
                    <Link href="/dealvault/demo">
                      Request Private Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#pricing">See Pricing</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Link href="/services/dealvault" className="underline-offset-4 hover:underline">
                Read the DealVault service guide
              </Link>
              <Link href="/services" className="underline-offset-4 hover:underline">
                Compare all services
              </Link>
            </div>

            <div className="divide-y divide-white/10 border-y border-white/10">
              {trustPoints.map((item) => (
                <div key={item} className="py-4">
                  <div className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#b7ff3c]" />
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              DealVault helps track and prove agreement records. It does not replace legal counsel,
              licensed title services, escrow services, brokerage compliance, or required real
              estate professionals.
            </p>
          </div>

          <Card className="overflow-hidden border-white/10 bg-[#0e1114] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#b7ff3c]" />
                Built for operating records
              </CardTitle>
              <CardDescription>
                DealVault keeps agreement, payout, and milestone history verifiable without putting private documents on-chain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-background/70 p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                <p className="text-sm font-semibold text-foreground">Agreement tracking</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a tamper-evident proof trail without exposing private deal documents.
                </p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                <p className="text-sm font-semibold text-foreground">Transparent payout records</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lock and review partner splits in a cleaner ledger before friction turns expensive.
                </p>
              </div>
              <div className="rounded-xl border bg-background/70 p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                  <p className="text-sm font-semibold text-foreground">Project accountability</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                  Keep proof-backed milestone history visible for project, service, and approval-based work.
                  </p>
                </div>
              <div className="rounded-xl border border-[#b7ff3c]/20 bg-[#b7ff3c]/[0.05] p-4 transition-colors duration-200 hover:border-[#b7ff3c]/40">
                <p className="text-sm font-semibold text-foreground">Best match</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Real estate teams first, plus lenders, contractors, agencies, staffing teams,
                  and other partner-heavy businesses that want cleaner discipline around records.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section
          id="live-contracts"
          className="grid min-w-0 gap-8 border-y border-white/10 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,.98fr)]"
        >
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[#b7ff3c] text-[#11130f]">Live contract layer</Badge>
              <Badge variant="outline">Chain ID {dealVaultPublicDemo.chainId}</Badge>
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Proof close to the decision point</h2>
              <p className="mt-2 max-w-3xl text-muted-foreground">
                Instead of asking visitors to believe the story, DealVault shows the live contract
                layer, public explorer references, and a verified smoke run directly on the page.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="min-w-0 rounded-xl border bg-background/70 p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                <p className="text-sm font-semibold text-foreground">Mainnet deployment</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live since {new Date(dealVaultPublicDemo.liveSince).toLocaleString()}.
                </p>
              </div>
              <div className="min-w-0 rounded-xl border bg-background/70 p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                <p className="text-sm font-semibold text-foreground">Verified smoke run</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Verified on {new Date(dealVaultPublicDemo.smokeVerifiedAt).toLocaleString()} with
                  proof, deal, payout, and milestone records written successfully.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="min-w-0 rounded-xl border bg-background/70 p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileCheck className="h-4 w-4 text-[#b7ff3c]" />
                  Sample proof ID
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {dealVaultPublicDemo.sampleProofId}
                </p>
              </div>
              <div className="min-w-0 rounded-xl border bg-background/70 p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Blocks className="h-4 w-4 text-[#b7ff3c]" />
                  Sample project ID
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {dealVaultPublicDemo.sampleProjectId}
                </p>
              </div>
            </div>
          </div>

          <Card className="min-w-0 border-white/10 bg-[#0e1114] shadow-none border-[#b7ff3c]/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-[#b7ff3c]" />
                Live contract cards
              </CardTitle>
              <CardDescription>
                Production contracts powering the premium demo experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {dealVaultPublicContracts.map((contract) => (
                <div key={contract.key} className="group min-w-0 rounded-xl border p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                  <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{contract.label}</p>
                      <p className="text-base font-medium">{contract.title}</p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={contract.explorerUrl} target="_blank" rel="noopener noreferrer">
                        PolygonScan
                        <Link2 className="ml-2 h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </a>
                    </Button>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{contract.description}</p>
                  <p className="mt-3 break-all rounded-md bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
                    {shortenHex(contract.address, 12, 8)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {primaryModules.map((module) => (
            <Card key={module.title} className="border-white/10 bg-[#0e1114] shadow-none h-full border-[#b7ff3c]/10">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-[#b7ff3c]/10 text-[#b7ff3c]">
                  <module.icon className="h-5 w-5" />
                </div>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section id="pricing" className="space-y-5">
          <div className="space-y-2">
            <Badge className="bg-[#b7ff3c] text-[#11130f]">Pricing</Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Premium pricing for teams that need stronger accountability.
            </h2>
            <p className="max-w-3xl text-muted-foreground">
              DealVault is built for teams that care about cleaner records, better accountability, and a stronger audit story around deals.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.title}
                className={`border-white/10 bg-[#0e1114] shadow-none ${
                  tier.emphasis
                    ? 'border-[#b7ff3c]/40'
                    : 'border-[#b7ff3c]/20'
                }`}
              >
                <CardHeader>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <Badge variant="outline">{tier.title}</Badge>
                    {tier.emphasis && (
                      <Badge className="bg-[#b7ff3c] text-white">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-3xl">{tier.price}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {tier.bullets.map((item) => (
                      <li key={item} className="flex gap-2">
                        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#b7ff3c]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className={tier.emphasis ? 'w-full bg-[#b7ff3c] hover:bg-[#a8f52a]' : 'w-full'}
                    variant={tier.emphasis ? 'default' : 'outline'}
                  >
                    <Link href="/dealvault/demo">Request Private Demo</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_.95fr]">
            <Card className="border-white/10 bg-[#0e1114] shadow-none border-[#b7ff3c]/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-[#b7ff3c]" />
                  Premium rollout economics
                </CardTitle>
                <CardDescription>
                  Higher-touch implementations and proof-heavy records deserve clear pricing and clear scope.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-xl border p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                  <p className="font-medium text-foreground">Setup / custom configuration</p>
                  <p className="mt-1">$997-$5,000 depending on rollout depth and team complexity.</p>
                </div>
                <div className="rounded-xl border p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                  <p className="font-medium text-foreground">Proof certificate pricing</p>
                  <p className="mt-1">$25 per certificate for teams that want a polished proof document for counterparties or audit support.</p>
                </div>
                <div className="rounded-xl border p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                  <p className="font-medium text-foreground">Future premium option</p>
                  <p className="mt-1">Potential payout tracking fee band of 0.5%-1% once the product moves beyond the current early-access phase.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#0e1114] shadow-none border-[#b7ff3c]/20">
              <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#b7ff3c]" />
                  Best match
              </CardTitle>
              <CardDescription>
                  DealVault works best for teams that already feel the pain of fragmented records.
              </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {useCases.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#b7ff3c]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_.95fr]">
          <Card className="border-white/10 bg-[#0e1114] shadow-none">
            <CardHeader>
              <CardTitle>How it works</CardTitle>
              <CardDescription>
                The process is simple: record the agreement, track the activity, and keep the history visible.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {processSteps.map((step, index) => (
                <div key={step.title} className="rounded-xl border p-4 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                  <p className="text-sm font-semibold text-[#b7ff3c]">Step {index + 1}</p>
                  <p className="mt-1 font-medium text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#0e1114] shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-[#b7ff3c]" />
                Buyer-ready answers
              </CardTitle>
              <CardDescription>
                The public layer answers the questions searchers and answer engines ask before they book a demo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {faqItems.map((item) => (
                <div key={item.question} className="rounded-md border p-3 transition-colors duration-200 hover:border-[#b7ff3c]/30">
                  <p className="font-medium text-foreground">{item.question}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_.95fr]">
          <Card className="border-white/10 bg-[#0e1114] shadow-none border-[#b7ff3c]/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Presentation className="h-5 w-5 text-[#b7ff3c]" />
                Sample certificate showcase
              </CardTitle>
              <CardDescription>
                Trust proof should sit close to pricing and the demo request, not hidden at the bottom of the page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-white">
                <Image
                  src={dealVaultPublicDemo.certificateImagePath}
                  alt="DealVault sample proof certificate preview"
                  width={1200}
                  height={900}
                  className="h-auto w-full"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-[#b7ff3c] hover:bg-[#a8f52a]">
                  <a href={dealVaultPublicDemo.certificatePdfPath} target="_blank" rel="noopener noreferrer">
                    View Sample Certificate
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="#live-contracts">Review Live Contract Layer</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <DealVaultPilotInterestForm />
        </section>
      </div>
    </main>
  );
}
