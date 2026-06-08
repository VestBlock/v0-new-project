import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileCheck2,
  Network,
  ReceiptText,
  ShieldCheck,
  Target,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { absoluteUrl } from '@/lib/seo/site'

export const metadata: Metadata = {
  title: 'VestBlock Deal Record Library',
  description:
    'Review sample VestBlock deal records for trust snapshots, verified buy boxes, lender fit, DealVault records, payout tracking, and deal review.',
  alternates: {
    canonical: '/proof',
  },
  openGraph: {
    title: 'VestBlock Deal Record Library',
    description:
      'Sample trust snapshot, verified buy-box, lender-fit, DealVault, and deal-review records for real estate operators.',
    url: absoluteUrl('/proof'),
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock deal record library preview',
      },
    ],
  },
}

const proofAssets = [
  {
    title: 'Deal Trust Snapshot',
    description:
      'A shareable deal record that shows criteria, document status, freshness, missing information, relationship stage, and recommended next step.',
    icon: ShieldCheck,
    fields: ['Criteria', 'Proof status', 'Freshness', 'Missing info', 'Next step'],
  },
  {
    title: 'Verified Buy Box Exchange',
    description:
      'A buyer-maintained criteria profile that keeps markets, asset appetite, price range, proof-of-funds status, and close speed current.',
    icon: Target,
    fields: ['Markets', 'Asset types', 'Price range', 'Proof of funds', 'Last confirmed'],
  },
  {
    title: 'Seller intake summary',
    description:
      'A clean seller record showing property type, location, condition, timeline, motivation, asking price, and missing information.',
    icon: Building2,
    fields: ['Property basics', 'Seller motivation', 'Timeline', 'Missing info', 'Recommended route'],
  },
  {
    title: 'Buyer criteria profile',
    description:
      'A structured buy-box record for markets, asset appetite, price range, proof-of-funds status, close speed, and relationship stage.',
    icon: Target,
    fields: ['Markets', 'Asset types', 'Price range', 'Proof of funds', 'Close speed'],
  },
  {
    title: 'Lender-fit profile',
    description:
      'A lender criteria snapshot for state coverage, loan range, DSCR appetite, low-doc status, credit criteria, and speed to close.',
    icon: Network,
    fields: ['States served', 'Loan range', 'DSCR', 'Low-doc', 'Speed to close'],
  },
  {
    title: 'Deal review recommendation',
    description:
      'A next-step view that explains whether a deal should go to a buyer, lender, paid review, or DealVault.',
    icon: BadgeCheck,
    fields: ['Best route', 'Fit rationale', 'Missing info', 'Review status', 'Fallback path'],
  },
  {
    title: 'DealVault record',
    description:
      'A certificate-ready record for agreement details, event history, private-file safeguards, public reference, and certificate output.',
    icon: ShieldCheck,
    fields: ['Proof ID', 'Timestamp', 'Status', 'Event history', 'Certificate'],
  },
  {
    title: 'Payout and milestone trail',
    description:
      'A record of referral splits, JV terms, milestone submissions, approvals, disputes, and completion history.',
    icon: ReceiptText,
    fields: ['Split terms', 'Milestones', 'Approvals', 'Disputes', 'Completion trail'],
  },
] as const

const sampleFlow = [
  'Seller submits a property or operator submits a funding deal.',
  'VestBlock compares buyer and lender fit using saved criteria and missing-info checks.',
  'A person reviews outreach readiness before any relationship message is sent.',
  'Qualified deals with proof, payout, or milestone risk get a DealVault recommendation.',
  'The team uses deal records to explain next steps without promising funding, closing, or revenue.',
] as const

export default function ProofAssetLibraryPage() {
  return (
    <main className="premium-page px-4 py-24">
      <div className="container mx-auto max-w-7xl space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
          <div className="space-y-5">
            <Badge className="w-fit bg-cyan-600 text-white">Deal records</Badge>
            <h1 className="max-w-5xl text-4xl font-bold tracking-tight md:text-6xl">
              Show serious operators the record trail before they buy.
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
              VestBlock should not ask buyers to imagine the process. These records explain
              trust snapshots, verified buy boxes, lender fit, DealVault records, and
              payout tracking in a form a real estate operator can inspect.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
                <Link href="/dealflow-growth-system">
                  View DealFlow Support
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/dealvault/demo">See DealVault Demo</Link>
              </Button>
            </div>
          </div>

          <Card className="premium-card border-cyan-500/20">
            <CardHeader>
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <CardTitle>Record library purpose</CardTitle>
              <CardDescription>
                Every record should either improve deal review, partner quality, DealVault confidence, or operator retention.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {sampleFlow.map((item) => (
                <div key={item} className="flex gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {proofAssets.map((asset) => {
            const Icon = asset.icon

            return (
              <Card key={asset.title} className="premium-card flex h-full flex-col">
                <CardHeader>
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{asset.title}</CardTitle>
                  <CardDescription>{asset.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <div className="flex flex-wrap gap-2">
                    {asset.fields.map((field) => (
                      <Badge key={field} variant="outline">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>

        <section className="premium-section p-8 text-center md:p-10">
          <Badge variant="outline">Review rule</Badge>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">
            Deal records should make the next conversation clearer.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            The best VestBlock features create clear records a buyer, lender, seller, or partner can
            review. The service should become more valuable with every deal, buyer, lender, and
            DealVault record completed.
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
  )
}
