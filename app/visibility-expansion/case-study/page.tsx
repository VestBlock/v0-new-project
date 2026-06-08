import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ExternalLink, LineChart, Search, ShieldCheck, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { absoluteUrl } from '@/lib/seo/site';
import { articleJsonLd, breadcrumbJsonLd, organizationJsonLd } from '@/lib/seo/structuredData';

export const metadata: Metadata = {
  title: 'VestBlock Visibility Case Study | From Blocked To AI-Search Ready',
  description:
    'See how VestBlock is using its own Search Visibility process to recover crawlability, publish AI-search pages, improve llms.txt coverage, and build public proof materials.',
  alternates: {
    canonical: '/visibility-expansion/case-study',
  },
  keywords: [
    'VestBlock visibility case study',
    'AI search visibility case study',
    'small business search visibility proof',
    'llms.txt case study',
    'DealVault visibility',
    'AI receptionist visibility',
  ],
  openGraph: {
    title: 'VestBlock Visibility Case Study',
    description:
      'How VestBlock is documenting its own climb from blocked site to crawlable AI-search-ready brand.',
    url: absoluteUrl('/visibility-expansion/case-study'),
    type: 'article',
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'VestBlock visibility case study preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VestBlock Visibility Case Study',
    description:
      'A live proof log for the VestBlock Search Visibility process.',
    images: [absoluteUrl('/opengraph-image')],
  },
};

const scoreMilestones = [
  {
    score: '22/100',
    label: 'Blocked',
    date: 'May 12, 2026',
    description:
      'The site was returning Vercel deployment-disabled responses, which meant crawlers and buyers could not reliably access the newest pages.',
  },
  {
    score: '54/100',
    label: 'Restored',
    date: 'May 12, 2026',
    description:
      'Vercel billing was resolved, production routes returned 200, sitemap.xml and llms.txt were live again, and DealVault demo pages became crawlable.',
  },
  {
    score: '60/100',
    label: 'AI-search ready foundation',
    date: 'May 13, 2026',
    description:
      'VestBlock added exact-match learn pages for DealVault proof records, smart contract records, AI Receptionist, Search Visibility, AI-search visibility, and website lead capture.',
  },
];

const proofUrls = [
  {
    label: 'DealVault proof records',
    href: '/learn/dealvault-proof-records',
  },
  {
    label: 'Smart contract records for business',
    href: '/learn/smart-contract-records-for-business',
  },
  {
    label: 'AI Receptionist for small business',
    href: '/learn/ai-receptionist-for-small-business',
  },
  {
    label: 'Search Visibility for small business',
    href: '/learn/search-visibility-for-small-business',
  },
  {
    label: 'AI search visibility',
    href: '/learn/ai-search-visibility',
  },
  {
    label: 'Website lead capture guide',
    href: '/learn/website-lead-capture-system',
  },
];

const nextMilestones = [
  'Capture before-and-after screenshots for search results, sitemap health, llms.txt, and live route checks.',
  'Publish YouTube videos and descriptions that link back to the exact service and learn pages.',
  'Create off-site mentions through founder posts, PR pitches, partner pages, and public profiles.',
  'Track indexed pages, exact-match brand searches, crawler access, and AI-answer readiness weekly.',
];

const proofAssets = [
  {
    label: 'Visibility scorecard graphic',
    href: '/proof/visibility/vestblock-visibility-scorecard.svg',
  },
  {
    label: 'Case study screenshot',
    href: '/proof/visibility/visibility-case-study.png',
  },
  {
    label: 'Search Visibility page screenshot',
    href: '/proof/visibility/search-visibility-service.png',
  },
  {
    label: 'DealVault demo screenshot',
    href: '/proof/visibility/dealvault-demo-record.png',
  },
  {
    label: 'AI Receptionist screenshot',
    href: '/proof/visibility/ai-receptionist.png',
  },
  {
    label: 'AI feed screenshot',
    href: '/proof/visibility/llms-feed.png',
  },
  {
    label: 'Sitemap screenshot',
    href: '/proof/visibility/sitemap.png',
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

const faqs = [
  {
    question: 'Does the VestBlock visibility score guarantee rankings or leads?',
    answer:
      'No. The score is a readiness review for crawlability, page clarity, AI-search structure, proof materials, and off-site trust signals. Rankings, traffic, leads, and revenue depend on competition, timing, offer strength, and buyer demand.',
  },
  {
    question: 'Why did the score start so low?',
    answer:
      'VestBlock was temporarily blocked by a Vercel deployment issue, so buyers and crawlers could not reliably access the site. Restoring production access was the first visibility milestone.',
  },
  {
    question: 'What does 100/100 require?',
    answer:
      'A 100/100 score requires a live, crawlable site, strong service pages, AI-search-ready answers, sitemap and llms.txt coverage, proof materials, videos, screenshots, off-site mentions, and recurring tracking.',
  },
  {
    question: 'Can a small business use the same process?',
    answer:
      'Yes. VestBlock adapts the same process for service businesses that need clearer pages, better lead capture, stronger proof, and more helpful content for Google, ChatGPT, Perplexity, Gemini, and other discovery tools.',
  },
];

function visibilityCaseStudyFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export default function VisibilityCaseStudyPage() {
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Search Visibility', path: '/visibility-expansion' },
    { name: 'Visibility Case Study', path: '/visibility-expansion/case-study' },
  ]);
  const article = articleJsonLd({
    headline: 'VestBlock Visibility Case Study',
    description:
      'A live proof log showing how VestBlock is using its own Search Visibility process to improve crawlability, AI-search readiness, and public proof.',
    path: '/visibility-expansion/case-study',
    keywords: [
      'VestBlock',
      'Search Visibility',
      'AI search visibility',
      'DealVault',
      'AI Receptionist',
      'llms.txt',
    ],
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            organizationJsonLd(),
            breadcrumbs,
            article,
            visibilityCaseStudyFaqJsonLd(),
          ]),
        }}
      />

      <section className="relative overflow-hidden border-b border-white/10 px-4 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.14),transparent_32%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="container relative mx-auto max-w-6xl">
          <div className="max-w-3xl space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                Live proof log
              </Badge>
              <Badge variant="outline" className="border-white/20 text-cyan-100">
                Search Visibility case study
              </Badge>
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              We are using VestBlock&apos;s visibility service on VestBlock first.
            </h1>
            <p className="text-lg leading-8 text-slate-300">
              This page tracks the real work behind our Search Visibility offer:
              restoring crawlability, publishing AI-search-ready pages, improving
              llms.txt coverage, and building public proof that buyers can inspect.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                <Link href="/visibility-expansion">
                  Request Visibility Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Link href="/llms.txt">
                  View llms.txt
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="container mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {scoreMilestones.map((milestone) => (
            <Card key={milestone.score} className="border-white/10 bg-white/[0.04] text-white shadow-2xl shadow-cyan-950/20">
              <CardHeader>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
                  <LineChart className="h-5 w-5" />
                </div>
                <CardTitle className="text-4xl">{milestone.score}</CardTitle>
                <CardDescription className="text-cyan-100">
                  {milestone.label} · {milestone.date}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-300">{milestone.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03] px-4 py-14">
        <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <Badge variant="outline" className="border-cyan-300/40 text-cyan-100">
              What changed
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              The visibility package is becoming proof-backed, not just a marketing promise.
            </h2>
            <p className="leading-7 text-slate-300">
              The first win was making the website crawlable again. The second win
              was publishing clear pages that directly answer the questions buyers,
              search engines, and AI answer tools need to understand.
            </p>
          </div>
          <div className="grid gap-3">
            {proofUrls.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/80 p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-slate-900"
              >
                <span className="font-medium text-slate-100">{item.label}</span>
                <ArrowRight className="h-4 w-4 text-cyan-200 transition group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="container mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          <Card className="border-white/10 bg-white/[0.04] text-white">
            <CardHeader>
              <Search className="mb-2 h-6 w-6 text-cyan-200" />
              <CardTitle>Owned search foundation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-slate-300">
              Sitemap, robots.txt, llms.txt, service pages, and exact-match learn
              pages give crawlers a clearer map of what VestBlock does.
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/[0.04] text-white">
            <CardHeader>
              <Sparkles className="mb-2 h-6 w-6 text-cyan-200" />
              <CardTitle>AI-answer readiness</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-slate-300">
              The new pages answer what DealVault, AI Receptionist, Search
              Visibility, smart contract records, and lead capture are in plain language.
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/[0.04] text-white">
            <CardHeader>
              <ShieldCheck className="mb-2 h-6 w-6 text-cyan-200" />
              <CardTitle>Safe proof language</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-slate-300">
              The case study avoids guarantees. It shows our own process and
              gives prospects proof of how the work is performed.
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-14">
        <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Next milestones toward 100/100</h2>
            <p className="leading-7 text-slate-300">
              A higher score requires more than our own website. The next stage is
              public corroboration: videos, posts, citations, partner mentions,
              screenshots, and recurring scorecard proof.
            </p>
            <div className="grid gap-3">
              {nextMilestones.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                  <p className="text-sm leading-6 text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <Card className="border-cyan-300/20 bg-cyan-300/10 text-white">
            <CardHeader>
              <CardTitle>Important guardrail</CardTitle>
              <CardDescription className="text-cyan-50">
                This case study proves VestBlock&apos;s own process, not guaranteed client outcomes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-slate-200">
              <p>
                Search rankings, AI answers, traffic, leads, and revenue depend on
                competition, content quality, crawl timing, off-site proof, market
                trust, and the business offer.
              </p>
              <p>
                The value of the package is the repeatable work: audit,
                publication, clarity, proof materials, monitoring, and iteration.
              </p>
              <Button asChild className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                <Link href="/visibility-expansion#request-visibility-review">
                  Request Your Visibility Review
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t border-white/10 px-4 py-14">
        <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-4">
            <Badge variant="outline" className="border-cyan-300/40 text-cyan-100">
              Proof materials
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Screenshots and graphics buyers can inspect.
            </h2>
            <p className="leading-7 text-slate-300">
              These are public proof files captured from the live VestBlock site.
              They make the visibility work easier to show in posts, videos,
              pitch decks, and sales conversations.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {proofAssets.map((asset) => (
              <Link
                key={asset.href}
                href={asset.href}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-white/[0.07]"
              >
                <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-100">
                  {asset.label}
                  <ExternalLink className="h-4 w-4 text-cyan-200 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-slate-900/50 px-4 py-14">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-8 max-w-3xl space-y-3">
            <Badge variant="outline" className="border-cyan-300/40 text-cyan-100">
              Buyer questions
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight">What this proves, and what it does not</h2>
            <p className="leading-7 text-slate-300">
              We want this asset to sell honestly. The case study shows the work,
              the milestones, and the next proof we still need to publish.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <Card key={faq.question} className="border-white/10 bg-white/[0.04] text-white">
                <CardHeader>
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-slate-300">
                  {faq.answer}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
