import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { absoluteUrl, vestBlockSiteName } from '@/lib/seo/site';
import { breadcrumbJsonLd } from '@/lib/seo/structuredData';
import {
  getServiceSeoPage,
  serviceSeoPages,
  type ServiceSeoFaq,
} from '@/lib/seo/serviceSeoPages';

const legacyServiceSlugs: Record<string, string> = {
  'credit-card-stacking-strategy': 'business-funding-strategy',
};

export function generateStaticParams() {
  return serviceSeoPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (legacyServiceSlugs[slug]) {
    redirect(`/services/${legacyServiceSlugs[slug]}`);
  }

  const page = getServiceSeoPage(slug);

  if (!page) {
    return {
      title: 'VestBlock Service Guide',
    };
  }

  return {
    title: page.seoTitle,
    description: page.metaDescription,
    alternates: {
      canonical: `/services/${page.slug}`,
    },
    openGraph: {
      title: page.seoTitle,
      description: page.metaDescription,
      url: absoluteUrl(`/services/${page.slug}`),
    },
  };
}

function faqJsonLd(faqs: ServiceSeoFaq[]) {
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

function serviceJsonLd(page: NonNullable<ReturnType<typeof getServiceSeoPage>>) {
  const numericPrice = page.priceLabel?.replace(/[^0-9.]/g, '');

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: page.title,
    url: absoluteUrl(`/services/${page.slug}`),
    description: page.metaDescription,
    audience: page.audience,
    provider: {
      '@type': 'Organization',
      name: vestBlockSiteName,
      url: absoluteUrl('/'),
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${page.title} next steps`,
      itemListElement: [
        {
          '@type': 'Offer',
          name: page.primaryCta,
          url: absoluteUrl(page.primaryRoute),
          availability: 'https://schema.org/InStock',
          ...(numericPrice
            ? {
                price: numericPrice,
                priceCurrency: 'USD',
              }
            : {}),
        },
      ],
    },
  };
}

export default async function ServiceSeoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getServiceSeoPage(slug);

  if (!page) notFound();

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Services', path: '/services' },
              { name: page.title, path: `/services/${page.slug}` },
            ]),
            serviceJsonLd(page),
            faqJsonLd(page.faqs),
          ]),
        }}
      />

      <section className="border-b px-4 py-24">
        <div className="container mx-auto max-w-5xl">
          <Badge className="mb-4 w-fit bg-cyan-600 text-white">
            VestBlock service guide
          </Badge>
          {page.priceLabel && (
            <Badge variant="outline" className="mb-4 ml-3">
              {page.priceLabel}
            </Badge>
          )}
          <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
            {page.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
            {page.excerpt}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-cyan-600 hover:bg-cyan-700">
              <Link href={page.primaryRoute}>
                {page.primaryCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {page.secondaryRoute && page.secondaryCta && (
              <Button asChild size="lg" variant="outline">
                {page.secondaryRoute.startsWith('http') ? (
                  <a
                    href={page.secondaryRoute}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {page.secondaryCta}
                  </a>
                ) : (
                  <Link href={page.secondaryRoute}>{page.secondaryCta}</Link>
                )}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="container mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
          <article className="space-y-6">
            {page.sections.map((section) => (
              <Card key={section.heading}>
                <CardHeader>
                  <CardTitle>{section.heading}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-muted-foreground">
                  <p>{section.body}</p>
                  {section.bullets && (
                    <ul className="grid gap-2 text-sm">
                      {section.bullets.map((item) => (
                        <li key={item} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardHeader>
                <CardTitle>Common Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {page.faqs.map((faq) => (
                  <div key={faq.question} className="border-b pb-4 last:border-0 last:pb-0">
                    <h2 className="font-semibold">{faq.question}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </article>

          <aside className="space-y-4">
            <Card className="border-cyan-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-cyan-600" />
                  Safe Next Step
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  This guide is educational and connects to a VestBlock tool or
                  service. It does not promise credit, funding, grant, approval,
                  real estate, or financial outcomes.
                </p>
                <Button asChild className="w-full">
                  <Link href={page.primaryRoute}>{page.primaryCta}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Related Guides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {page.relatedSlugs.map((relatedSlug) => {
                  const related = getServiceSeoPage(relatedSlug);
                  if (!related) return null;

                  return (
                    <Button
                      key={related.slug}
                      asChild
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Link href={`/services/${related.slug}`}>
                        {related.title}
                      </Link>
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Services</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/services">Compare VestBlock Services</Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
}
