import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import demoPackage from '@/deployments/dealvault-demo-package.json';
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
  title: 'DealVault Demo Record | Agreement Proof, Payouts, and Milestones',
  description:
    'Walk through a buyer-ready DealVault demo record with a sample agreement PDF, proof hash, payout splits, milestones, and certificate output.',
  alternates: {
    canonical: '/dealvault/demo-record',
  },
  openGraph: {
    title: 'DealVault Demo Record By VestBlock',
    description:
      'A buyer-ready proof trail showing how DealVault organizes agreement records, payout visibility, milestone status, and certificate output.',
    url: absoluteUrl('/dealvault/demo-record'),
    images: [
      {
        url: absoluteUrl('/dealvault/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'DealVault demo record preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DealVault Demo Record By VestBlock',
    description:
      'See a sample agreement become a hash-backed DealVault record with payouts, milestones, and certificate output.',
    images: [absoluteUrl('/dealvault/opengraph-image')],
  },
};

const proofCards = [
  {
    title: 'Agreement PDF stays private',
    body: 'The sample agreement can be downloaded and reviewed, but the raw PDF is not placed on-chain.',
    icon: LockKeyhole,
  },
  {
    title: 'Hash proves the exact file',
    body: 'The SHA-256 hash creates a fingerprint for the demo PDF, so the proof record points to one exact version.',
    icon: Fingerprint,
  },
  {
    title: 'Business details stay organized',
    body: 'The demo connects the record to payout splits, milestone status, certificate output, and proof metadata.',
    icon: FileCheck2,
  },
];

const buyerFlow = [
  {
    label: '1',
    title: 'Review the sample agreement',
    body: 'Start with a plain-English demo agreement that explains referral splits, milestone records, proof language, and disclaimers.',
  },
  {
    label: '2',
    title: 'Confirm the file hash',
    body: 'DealVault hashes the PDF and records only the hash, proof type, timestamp, and external reference in the demo package.',
  },
  {
    label: '3',
    title: 'Track who is owed what',
    body: 'Payout splits show how referral partners, service providers, or project teams can see accountability without moving funds on-chain.',
  },
  {
    label: '4',
    title: 'Follow milestone status',
    body: 'Milestones show work moving from upload to review, submission, and certificate-ready proof output.',
  },
];

const packageStats = [
  ['Demo deal ID', demoPackage.demoDealId],
  ['Proof type', demoPackage.proof.proofType],
  ['External reference', demoPackage.proof.externalReference],
  ['Raw PDF sent on-chain', demoPackage.proof.sendsRawDocumentOnChain ? 'Yes' : 'No'],
];

function statusLabel(status: string) {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function DealVaultDemoRecordPage() {
  return (
    <main className="premium-page px-4 py-24">
      <div className="container mx-auto max-w-7xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-cyan-600 text-white">Buyer-ready demo</Badge>
              <Badge variant="outline">No wallet required</Badge>
              <Badge variant="outline">Proof-first record</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
                See the proof trail before you book.
              </h1>
              <p className="max-w-3xl text-lg text-muted-foreground">
                This sample shows how DealVault turns an agreement PDF into a clean business
                record with a document hash, payout visibility, milestone status, and certificate
                output without putting private documents on-chain.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="/dealvault/demo#dealvault-demo">
                  Request A Private Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={demoPackage.pdf.publicPath} target="_blank" rel="noopener noreferrer">
                  Download Agreement
                  <Download className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            <p className="max-w-3xl text-sm text-muted-foreground">
              This is a fictional demo agreement for product education only. DealVault does not
              replace attorneys, escrow, title, brokerage compliance, or required written agreements.
            </p>
          </div>

          <Card className="premium-card border-cyan-500/20 bg-cyan-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-600" />
                Demo package snapshot
              </CardTitle>
              <CardDescription>
                Everything a buyer needs to understand the record, proof, and next step.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {packageStats.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold">{String(value)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {proofCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.title} className="premium-card border-cyan-500/15">
                <CardHeader>
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  <CardDescription>{card.body}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-8 lg:grid-cols-[.95fr_1.05fr]">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-cyan-600" />
                The proof fingerprint
              </CardTitle>
              <CardDescription>
                The hash identifies the PDF without exposing the PDF text on-chain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-600">
                  SHA-256 hash
                </p>
                <p className="mt-3 break-all font-mono text-sm text-muted-foreground">
                  {demoPackage.proof.documentHash}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
                  <a href={demoPackage.pdf.publicPath} target="_blank" rel="noopener noreferrer">
                    Download PDF
                    <Download className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a
                    href={demoPackage.certificate.pdfPath}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Certificate
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>

              {demoPackage.polygon.latestLiveProofExplorerUrl && (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={demoPackage.polygon.latestLiveProofExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Recent Polygon Proof Test
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle>What the buyer should understand</CardTitle>
              <CardDescription>
                DealVault is valuable when a team needs proof, accountability, and cleaner records
                for multi-party work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {buyerFlow.map((step) => (
                <div
                  key={step.title}
                  className="flex gap-4 rounded-xl border border-white/10 bg-background/70 p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-sm font-bold text-cyan-600">
                    {step.label}
                  </div>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-cyan-600" />
                Example payout visibility
              </CardTitle>
              <CardDescription>
                This does not move funds. It gives teams a clear record of who is connected to the agreement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {demoPackage.payoutSplits.map((split) => (
                <div key={split.party} className="rounded-xl border border-white/10 bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold">{split.party}</p>
                    <Badge variant="outline">{split.allocationPercent}%</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{statusLabel(split.status)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-cyan-600" />
                Example milestone trail
              </CardTitle>
              <CardDescription>
                Each milestone gives the team a visible status instead of scattered texts, emails, or screenshots.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {demoPackage.milestones.map((milestone) => (
                <div key={milestone.title} className="rounded-xl border border-white/10 bg-background/70 p-4">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                    <div>
                      <p className="font-semibold">{milestone.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {statusLabel(milestone.status)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.08fr_.92fr]">
          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <CardTitle>Certificate-ready output</CardTitle>
              <CardDescription>
                The certificate gives non-technical buyers a simple artifact they can understand, share, and review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border bg-white">
                <Image
                  src={demoPackage.certificate.imagePath}
                  alt="DealVault sample proof certificate"
                  width={1200}
                  height={900}
                  className="h-auto w-full"
                />
              </div>
              <Button asChild className="w-full bg-cyan-600 hover:bg-cyan-700">
                <a
                  href={demoPackage.certificate.pdfPath}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Proof Certificate
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="premium-card border-cyan-500/20 bg-cyan-500/5">
            <CardHeader>
              <Badge className="w-fit bg-cyan-600 text-white">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Sales takeaway
              </Badge>
              <CardTitle>What this proves for a buyer</CardTitle>
              <CardDescription>
                DealVault is not selling crypto complexity. It is selling cleaner records for
                agreements, payouts, approvals, and proof-heavy work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                If your business has multiple parties, referral fees, milestone approvals, vendor
                deliverables, or important documents, DealVault gives your team one place to show
                what happened and when.
              </p>
              <p>
                The blockchain layer is the proof layer. Supabase remains the application database.
                Private documents stay off-chain.
              </p>
              <Button asChild size="lg" className="w-full bg-cyan-600 hover:bg-cyan-700">
                <Link href="/dealvault/demo#dealvault-demo">
                  Request A Private Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
