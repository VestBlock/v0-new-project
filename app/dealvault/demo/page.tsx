import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BadgeCheck,
  Download,
  FileCheck,
  FileText,
  Fingerprint,
  Link2,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';

import { DealVaultPilotInterestForm } from '@/components/dealvault/dealvault-pilot-interest-form';
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
  dealVaultPublicContracts,
  dealVaultPublicDemo,
  shortenHex,
} from '@/lib/dealvault/contractMetadata';
import { absoluteUrl } from '@/lib/seo/site';
import demoPackage from '@/deployments/dealvault-demo-package.json';

export const metadata: Metadata = {
  title: 'DealVault Demo | See Proof, Payout, and Milestone Records',
  description:
    'See how DealVault by VestBlock turns agreement records, payout splits, milestone approvals, and proof certificates into a cleaner audit trail.',
  alternates: {
    canonical: '/dealvault/demo',
  },
  openGraph: {
    title: 'DealVault Demo By VestBlock',
    description:
      'A proof-first demo for agreement records, payout tracking, milestone approvals, and blockchain-backed event history.',
    url: absoluteUrl('/dealvault/demo'),
    images: [
      {
        url: absoluteUrl('/dealvault/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'DealVault demo preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DealVault Demo By VestBlock',
    description:
      'See proof records, payout ledgers, milestone approvals, and sample certificate output in one DealVault demo path.',
    images: [absoluteUrl('/dealvault/opengraph-image')],
  },
};

const demoSteps = [
  {
    title: 'Create the record',
    body: 'Start with a clean agreement record for a deal, project, referral, service engagement, or partner-heavy transaction.',
    icon: FileCheck,
  },
  {
    title: 'Attach proof',
    body: 'Store private documents off-chain while anchoring hashes, proof IDs, timestamps, and opaque references for review.',
    icon: Fingerprint,
  },
  {
    title: 'Track payouts and milestones',
    body: 'Record partner splits, referral status, draw approvals, vendor deliverables, and completion history without moving funds on-chain.',
    icon: ReceiptText,
  },
  {
    title: 'Share the audit trail',
    body: 'Use certificate output, dashboard activity, and Polygon explorer links to give teams a clearer record of what happened.',
    icon: Waypoints,
  },
];

const proofSummary = [
  ['Network', `${dealVaultPublicDemo.network} mainnet`],
  ['Chain ID', String(dealVaultPublicDemo.chainId)],
  ['Verified smoke run', new Date(dealVaultPublicDemo.smokeVerifiedAt).toLocaleString()],
  ['Sensitive data policy', 'Hashes, IDs, timestamps, statuses, and references only'],
];

const buyerProofQuestions = [
  'What record was created?',
  'When was proof attached?',
  'Which payout or milestone changed?',
  'Where is the public explorer reference?',
  'What should the team do next?',
];

const demoAgreementFlow = [
  'PDF Agreement',
  'Hash Created',
  'DealVault Record',
  'Milestones / Payouts',
  'Proof Certificate',
];

const demoAgreementStats = [
  ['Demo deal ID', demoPackage.demoDealId],
  ['Proof type', demoPackage.proof.proofType],
  ['External reference', demoPackage.proof.externalReference],
  ['Raw document on-chain', demoPackage.proof.sendsRawDocumentOnChain ? 'Yes' : 'No'],
];

export default function DealVaultDemoPage() {
  return (
    <main className="premium-page px-4 py-24">
      <div className="container mx-auto max-w-7xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-cyan-600 text-white">Demo path</Badge>
              <Badge variant="outline">Live on {dealVaultPublicDemo.network}</Badge>
              <Badge variant="outline">No wallet required</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
                See how DealVault proves the work.
              </h1>
              <p className="max-w-3xl text-lg text-muted-foreground">
                This demo shows the buyer path we want prospects to understand: create a clean
                record, attach proof, track payouts or milestones, and share a certificate-ready
                audit trail without putting private documents on-chain.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="#dealvault-demo">
                  Request This Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/smart-contracts">View Live Contracts</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={demoPackage.pdf.publicPath} target="_blank" rel="noopener noreferrer">
                  Download Sample Agreement
                  <Download className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/dealvault/demo-record">View Demo Record</Link>
              </Button>
            </div>

            <p className="max-w-3xl text-sm text-muted-foreground">
              DealVault supports recordkeeping, proof, payout visibility, and milestone history.
              It does not replace legal counsel, title, escrow, brokerage compliance, or required
              written agreements.
            </p>
          </div>

          <Card className="premium-card overflow-hidden border-cyan-500/20 bg-cyan-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-600" />
                What the demo proves
              </CardTitle>
              <CardDescription>
                The strongest sales asset is a visible proof trail, not another abstract feature list.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {buyerProofQuestions.map((question) => (
                <div
                  key={question}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-background/70 p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40"
                >
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                  <p className="text-sm text-muted-foreground">{question}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {demoSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <Card key={step.title} className="premium-card border-cyan-500/15">
                <CardHeader>
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">
                    Step {index + 1}
                  </p>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                  <CardDescription>{step.body}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-600" />
                Demo agreement package
              </CardTitle>
              <CardDescription>
                A fictional sample agreement becomes a hash-backed proof package. The PDF stays
                off-chain; DealVault uses the hash and clean references for the demo record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {demoAgreementStats.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                    <p className="mt-2 break-words text-sm font-medium">{String(value)}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-600">SHA-256 document hash</p>
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                  {demoPackage.proof.documentHash}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
                  <a href={demoPackage.pdf.publicPath} target="_blank" rel="noopener noreferrer">
                    Download Sample Demo Agreement
                    <Download className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={demoPackage.certificate.pdfPath} target="_blank" rel="noopener noreferrer">
                    View Proof Certificate
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dealvault/demo-record">View Buyer-Ready Demo Record</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle>How the demo moves through DealVault</CardTitle>
              <CardDescription>
                This is the buyer-friendly version of the proof flow. Customers do not need to
                connect a wallet to understand or request the demo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {demoAgreementFlow.map((step, index) => (
                  <div key={step} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-sm font-semibold text-cyan-600">
                      {index + 1}
                    </div>
                    <div className="flex-1 rounded-xl border border-white/10 bg-background/70 p-3 text-sm font-medium transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40">
                      {step}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                This sample is for product demonstration only. It is not legal advice and does not
                replace legal counsel, title, escrow, brokerage compliance, or required written
                agreements.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-8 lg:grid-cols-[.95fr_1.05fr]">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockKeyhole className="h-5 w-5 text-cyan-600" />
                Sample record, safe by design
              </CardTitle>
              <CardDescription>
                The public layer uses opaque references. Private documents and raw sensitive details stay off-chain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {proofSummary.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <p className="mt-2 break-words font-medium text-foreground">{value}</p>
                </div>
              ))}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-600">Sample proof ID</p>
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                  {dealVaultPublicDemo.sampleProofId}
                </p>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-600">Sample milestone project ID</p>
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                  {dealVaultPublicDemo.sampleProjectId}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle>Certificate-ready proof output</CardTitle>
              <CardDescription>
                The demo gives prospects a concrete artifact they can understand before they book.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-white">
                <Image
                  src={dealVaultPublicDemo.certificateImagePath}
                  alt="DealVault sample proof certificate"
                  width={1200}
                  height={900}
                  className="h-auto w-full"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
                  <a href={dealVaultPublicDemo.certificatePdfPath} target="_blank" rel="noopener noreferrer">
                    Open Sample Certificate
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link href="#dealvault-demo">Request Demo</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <Badge variant="outline">Public contract layer</Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Live contracts behind the demo
              </h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                The demo points back to real contract addresses so serious buyers can review the
                proof layer without needing to connect a wallet.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dealvault/demo-record">View Demo Record</Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {dealVaultPublicContracts.map((contract) => (
              <Card key={contract.key} className="premium-card border-white/10 hover:border-cyan-500/40">
                <CardHeader>
                  <Badge variant="outline" className="w-fit">
                    {contract.label}
                  </Badge>
                  <CardTitle>{contract.title}</CardTitle>
                  <CardDescription>{contract.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <code className="block rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    {shortenHex(contract.address, 10, 8)}
                  </code>
                  <Button asChild size="sm" variant="outline">
                    <a href={contract.explorerUrl} target="_blank" rel="noopener noreferrer">
                      View on PolygonScan
                      <Link2 className="ml-2 h-3.5 w-3.5" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[.92fr_1.08fr] lg:items-start">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle>Best-fit demo prospects</CardTitle>
              <CardDescription>
                The demo is strongest when a buyer already has multiple parties, approvals, payouts, or milestones to track.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Real estate teams with referral, JV, contractor, or creative-finance records.</p>
              <p>Private lenders and funding partners that need clearer draw or referral history.</p>
              <p>Agencies, consultants, staffing teams, and service businesses with deliverables, approvals, or placement fees.</p>
              <p>Contractors and project teams that need milestone status, proof submissions, and completion records.</p>
            </CardContent>
          </Card>

          <DealVaultPilotInterestForm />
        </section>
      </div>
    </main>
  );
}
