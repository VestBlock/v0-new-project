import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BadgeCheck,
  FileCheck,
  Link2,
  LockKeyhole,
  Network,
  ReceiptText,
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
import {
  dealVaultPublicContracts,
  dealVaultPublicDemo,
  shortenHex,
} from '@/lib/dealvault/contractMetadata';
import { absoluteUrl } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'VestBlock Smart Contract Records',
  description:
    'Live Polygon smart contract records for DealVault proof records, payout tracking, and milestone history without storing private documents on-chain.',
  alternates: {
    canonical: '/smart-contracts',
  },
  openGraph: {
    title: 'VestBlock Smart Contract Records',
    description:
      'Review VestBlock smart contract records for proof, payout, and milestone tracking on Polygon.',
    url: absoluteUrl('/smart-contracts'),
    images: [
      {
        url: absoluteUrl('/dealvault/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock smart contract records preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VestBlock Smart Contract Records',
    description:
      'Live proof, payout, and milestone record contracts behind DealVault by VestBlock.',
    images: [absoluteUrl('/dealvault/opengraph-image')],
  },
};

const proofPoints = [
  {
    title: 'Live on Polygon',
    body: `DealVault contracts are configured for ${dealVaultPublicDemo.network} with public explorer links.`,
    icon: Network,
  },
  {
    title: 'Private files stay private',
    body: 'VestBlock stores hashes, IDs, statuses, timestamps, and references on-chain, not raw documents.',
    icon: LockKeyhole,
  },
  {
    title: 'Built for audits',
    body: 'Proof records, payout status, and milestone history can be reviewed without exposing sensitive deal content.',
    icon: ShieldCheck,
  },
];

const recordTypes = [
  'Agreement proof records',
  'Referral and payout split status',
  'Contractor and project milestones',
  'Public transaction references',
  'Dashboard-ready activity history',
  'Certificate-ready proof trails',
];

export default function SmartContractsPage() {
  return (
    <main className="premium-page px-4 py-24">
      <div className="container mx-auto max-w-7xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.08fr_.92fr] lg:items-start">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-cyan-600 text-white">Live on Polygon</Badge>
              <Badge variant="outline">DealVault proof layer</Badge>
              <Badge variant="outline">No raw documents on-chain</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
                Smart contract records for real business agreements.
              </h1>
              <p className="max-w-3xl text-lg text-muted-foreground">
                VestBlock uses live smart contracts as a proof layer for DealVault. Teams can
                track proof records, payout status, and milestone history while keeping private
                files, contracts, and sensitive deal details off-chain.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="/dealvault/demo">
                  Request Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/dealvault#live-contracts">View DealVault Contracts</Link>
              </Button>
            </div>
          </div>

          <Card className="premium-card border-cyan-500/20 bg-cyan-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-cyan-600" />
                What this is, and is not
              </CardTitle>
              <CardDescription>
                Compliance-safe smart contract records for proof and accountability.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>VestBlock smart contracts support transparent event records and dashboard history.</p>
              <p>They do not replace attorneys, title companies, escrow, lenders, brokers, or required written agreements.</p>
              <p>They do not move customer funds, custody assets, or sell fractional real estate ownership.</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {proofPoints.map((point) => {
            const Icon = point.icon;
            return (
              <Card key={point.title} className="premium-card border-cyan-500/15 hover:border-cyan-500/40">
                <CardHeader>
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{point.title}</CardTitle>
                  <CardDescription>{point.body}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </section>

        <section id="contracts" className="space-y-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <Badge variant="outline">Public contract records</Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Live DealVault contracts
              </h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                These contracts support proof records, payout status, and milestone events for
                DealVault. Explorer links are public so activity can be reviewed.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/dealvault">Open DealVault</Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {dealVaultPublicContracts.map((contract) => (
              <Card
                key={contract.key}
                className="premium-card group border-white/10 hover:border-cyan-500/40"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge variant="outline">{contract.label}</Badge>
                      <CardTitle className="mt-3">{contract.title}</CardTitle>
                    </div>
                    <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-600">
                      {contract.key === 'partnerPay' ? (
                        <ReceiptText className="h-5 w-5" />
                      ) : (
                        <FileCheck className="h-5 w-5" />
                      )}
                    </div>
                  </div>
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

        <section className="premium-section grid gap-8 p-6 md:grid-cols-[.9fr_1.1fr] md:p-8">
          <div>
            <Badge className="bg-cyan-600 text-white">Record types</Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              What VestBlock can prove and organize
            </h2>
            <p className="mt-3 text-muted-foreground">
              DealVault is built for businesses that need cleaner proof around important
              agreements without exposing private files to the public blockchain.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {recordTypes.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-background/70 p-4 text-sm transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
