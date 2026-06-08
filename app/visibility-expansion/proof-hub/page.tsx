import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { absoluteUrl } from '@/lib/seo/site';
import { articleJsonLd, breadcrumbJsonLd, organizationJsonLd } from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'VestBlock Visibility Proof Hub',
  description:
    'Public proof materials, service facts, directory submissions, and crawlable references for VestBlock Search Visibility, AI Receptionist, and DealVault.',
  alternates: {
    canonical: '/visibility-expansion/proof-hub',
  },
  openGraph: {
    title: 'VestBlock Visibility Proof Hub',
    description:
      'A crawlable proof hub for VestBlock visibility work, service facts, proof materials, and public submissions.',
    url: absoluteUrl('/visibility-expansion/proof-hub'),
    type: 'article',
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock visibility proof hub preview',
      },
    ],
  },
};

const serviceFacts = [
  {
    title: 'Search Visibility',
    description:
      'VestBlock helps businesses improve service clarity, crawlable pages, answer-ready content, proof materials, and authority-building without promising rankings.',
    href: '/visibility-expansion',
  },
  {
    title: 'AI Receptionist',
    description:
      'VestBlock sets up website lead response, common-question handling, intake routing, and booking handoff for service businesses.',
    href: '/ai-assistant',
  },
  {
    title: 'DealVault',
    description:
      'DealVault organizes proof records, document hashes, payout visibility, milestone history, and certificates while keeping private documents off-chain.',
    href: '/dealvault/demo-record',
  },
];

const proofLinks = [
  {
    label: 'Visibility case study',
    href: '/visibility-expansion/case-study',
  },
  {
    label: 'Scorecard graphic',
    href: '/proof/visibility/vestblock-visibility-scorecard.svg',
  },
  {
    label: 'AIToolsIndex submission proof',
    href: '/proof/visibility/aitoolsindex-submission-success.png',
  },
  {
    label: 'TheToolBus submission proof',
    href: '/proof/visibility/thetoolbus-submission-success.png',
  },
  {
    label: 'Zearches submission proof',
    href: '/proof/visibility/zearches-submission-success.png',
  },
  {
    label: 'SaaSCubes submission proof',
    href: '/proof/visibility/saascubes-submission-success.png',
  },
];

const submittedListings = [
  'FindAIDir',
  'AIToolsIndex',
  'TheToolBus',
  'Zearches',
  'SaaSCubes',
];

const guardrails = [
  'No ranking, traffic, AI citation, revenue, funding, or legal outcome is guaranteed.',
  'DealVault proof records are positioned as recordkeeping support, not escrow, custody, title, legal advice, or automatic payout enforcement.',
  'Private documents should stay private; public proof materials use safe references, screenshots, hashes, IDs, links, and service explanations.',
];

function proofHubJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'VestBlock Visibility Proof Hub',
    url: absoluteUrl('/visibility-expansion/proof-hub'),
    description:
      'Public proof materials, service facts, directory submissions, and crawlable references for VestBlock services.',
    about: ['Search Visibility', 'AI Receptionist', 'DealVault', 'business proof records'],
    isPartOf: {
      '@type': 'WebSite',
      name: 'VestBlock',
      url: absoluteUrl('/'),
    },
    mainEntity: {
      '@type': 'ItemList',
      name: 'VestBlock public proof materials',
      itemListElement: proofLinks.map((proof, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: proof.label,
        url: absoluteUrl(proof.href),
      })),
    },
  };
}

export default function VisibilityProofHubPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Search Visibility', path: '/visibility-expansion' },
    { name: 'Proof Hub', path: '/visibility-expansion/proof-hub' },
  ]);
  const article = articleJsonLd({
    headline: 'VestBlock Visibility Proof Hub',
    description:
      'A public proof hub for VestBlock service facts, proof materials, directory submissions, and safe visibility claims.',
    path: '/visibility-expansion/proof-hub',
    keywords: [
      'VestBlock proof hub',
      'search visibility proof',
      'AI receptionist proof',
      'DealVault proof records',
      'AI search visibility',
    ],
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([organizationJsonLd(), breadcrumbs, article, proofHubJsonLd()]),
        }}
      />

      <section className="relative overflow-hidden border-b border-white/10 px-4 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.16),transparent_34%)]" />
        <div className="container relative mx-auto max-w-6xl space-y-8">
          <Badge className="w-fit border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
            Public Visibility Proof
          </Badge>
          <div className="max-w-4xl space-y-4">
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Proof buyers, search engines, and AI tools can actually read.
            </h1>
            <p className="text-lg text-slate-300 md:text-xl">
              This page collects the public facts, screenshots, submissions, and service
              explanations behind VestBlock&apos;s Search Visibility process. It is built to
              be clear for business owners and crawlable for discovery tools.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              <Link href="/visibility-expansion">
                Request Visibility Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
              <Link href="/visibility-expansion/case-study">View Case Study</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="container mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {serviceFacts.map((service) => (
            <Card key={service.title} className="border-white/10 bg-white/[0.04] text-white">
              <CardHeader>
                <CardTitle>{service.title}</CardTitle>
                <CardDescription className="text-slate-300">
                  {service.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                  <Link href={service.href}>
                    Open page
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03] px-4 py-14">
        <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <Badge variant="outline" className="border-emerald-300/30 text-emerald-100">
              Current proof score: 71/100
            </Badge>
            <h2 className="text-3xl font-semibold">What improved the score</h2>
            <p className="text-slate-300">
              VestBlock now has crawlable service pages, `llms.txt`, sitemap coverage,
              exact-match learn pages, proof screenshots, a case study, clear FAQ and how-it-works
              content, multiple off-site submissions, a public proof hub, comparison pages, and
              structured page details. The next lift comes from approved third-party listings, partner mentions,
              Search Console evidence, and Bing indexing proof.
            </p>
          </div>
          <div className="grid gap-3">
            {proofLinks.map((proof) => (
              <Link
                key={proof.href}
                href={proof.href}
                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200 transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-slate-900"
              >
                <span>{proof.label}</span>
                <ExternalLink className="h-4 w-4 text-slate-400 transition group-hover:text-cyan-200" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="container mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <Card className="border-white/10 bg-white/[0.04] text-white">
            <CardHeader>
              <CardTitle>Submitted directory targets</CardTitle>
              <CardDescription className="text-slate-300">
                These submissions are part of a public corroboration trail. Approval timing
                depends on the third-party directory.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {submittedListings.map((listing) => (
                <div key={listing} className="flex items-center gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  {listing}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.04] text-white">
            <CardHeader>
              <CardTitle>Safe visibility guardrails</CardTitle>
              <CardDescription className="text-slate-300">
                These rules keep the service credible and buyer-safe.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {guardrails.map((guardrail) => (
                <div key={guardrail} className="flex gap-3 text-sm text-slate-200">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{guardrail}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
