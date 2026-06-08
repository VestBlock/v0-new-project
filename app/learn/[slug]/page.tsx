import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
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
  clusterLabels,
  getAeoTopicBySlug,
  getRelatedAeoTopics,
  intentLabels,
  vestblockAeoTopics,
} from '@/lib/aeo/topics';
import { absoluteUrl } from '@/lib/seo/site';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/seo/structuredData';

type LearnTopicPageProps = {
  params: Promise<{ slug: string }>;
};

const spanishClusterLabels: Partial<Record<(typeof vestblockAeoTopics)[number]['cluster'], string>> = {
  funding: 'Financiamiento',
  'business-credit': 'Credito comercial',
  'credit-builder': 'Construccion de credito',
  disputes: 'Disputas de credito',
  'credit-repair': 'Reparacion de credito',
  dealvault: 'Registros de prueba DealVault',
  'search-visibility': 'Visibilidad de busqueda',
  'ai-receptionist': 'Recepcionista IA',
  'website-conversion': 'Conversion web',
};

const spanishIntentLabels: Partial<Record<(typeof vestblockAeoTopics)[number]['intent'], string>> = {
  education: 'Aprender',
  comparison: 'Comparar',
  'lead-capture': 'Prepararte',
  'tool-support': 'Usar herramienta',
};

export function generateStaticParams() {
  return vestblockAeoTopics.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({
  params,
}: LearnTopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const topic = getAeoTopicBySlug(slug);

  if (!topic) {
    return {
      title: 'VestBlock Guide',
    };
  }

  return {
    title: `${topic.title}${topic.language === 'es' ? '' : ' Guide'} | VestBlock`,
    description: topic.metaDescription,
    alternates: {
      canonical: `/learn/${topic.slug}`,
    },
    openGraph: {
      title: `${topic.title}${topic.language === 'es' ? '' : ' Guide'} | VestBlock`,
      description: topic.metaDescription,
      url: absoluteUrl(`/learn/${topic.slug}`),
      type: 'article',
      locale: topic.language === 'es' ? 'es_US' : 'en_US',
      images: [
        {
          url: absoluteUrl('/opengraph-image'),
          width: 1200,
          height: 630,
          alt: 'VestBlock guide preview',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${topic.title}${topic.language === 'es' ? '' : ' Guide'} | VestBlock`,
      description: topic.metaDescription,
      images: [absoluteUrl('/opengraph-image')],
    },
  };
}

function buildFaqSchema(topic: NonNullable<ReturnType<typeof getAeoTopicBySlug>>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: topic.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

function buildHowToSchema(topic: NonNullable<ReturnType<typeof getAeoTopicBySlug>>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `${topic.title}: next steps`,
    description: topic.metaDescription,
    totalTime: 'PT15M',
    step: topic.actionSteps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step,
      text: step,
    })),
  };
}

export default async function LearnTopicPage({ params }: LearnTopicPageProps) {
  const { slug } = await params;
  const topic = getAeoTopicBySlug(slug);

  if (!topic) {
    notFound();
  }

  const isSpanish = topic.language === 'es';
  const clusterLabel = isSpanish
    ? spanishClusterLabels[topic.cluster] || clusterLabels[topic.cluster]
    : clusterLabels[topic.cluster];
  const intentLabel = isSpanish
    ? spanishIntentLabels[topic.intent] || intentLabels[topic.intent]
    : intentLabels[topic.intent];
  const relatedTopics = getRelatedAeoTopics(topic);
  const faqSchema = buildFaqSchema(topic);
  const howToSchema = buildHowToSchema(topic);
  const articleSchema = articleJsonLd({
    headline: topic.title,
    description: topic.metaDescription,
    path: `/learn/${topic.slug}`,
    inLanguage: topic.language || 'en',
    keywords: [
      topic.title,
      clusterLabel,
      intentLabel,
      'VestBlock',
    ],
  });
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Learn', path: '/learn' },
    { name: topic.title, path: `/learn/${topic.slug}` },
  ]);

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([breadcrumbs, articleSchema, faqSchema, howToSchema]),
        }}
      />

      <section className="border-b bg-muted/30 px-4 py-12">
        <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{clusterLabel}</Badge>
              <Badge variant="outline">{intentLabel}</Badge>
            </div>
            <div className="max-w-3xl space-y-3">
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                {topic.title}
              </h1>
              <p className="text-lg text-muted-foreground">{topic.overview}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={topic.offerPath}>
                  {isSpanish
                    ? 'Abrir ruta relacionada de VestBlock'
                    : 'Open Related VestBlock Tool'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/learn">{isSpanish ? 'Todas las guias' : 'All Guides'}</Link>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{isSpanish ? 'Para quien sirve' : 'Who This Helps'}</CardTitle>
              <CardDescription>{topic.audience}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                {isSpanish
                  ? 'VestBlock ofrece educacion, preparacion y herramientas practicas. No garantiza aprobaciones, eliminaciones, cambios de puntaje, subvenciones, financiamiento, rankings, trafico, ingresos ni resultados legales.'
                  : 'VestBlock provides education, preparation, and practical tools. It does not guarantee approvals, deletions, score changes, grants, funding, rankings, traffic, revenue, or legal outcomes.'}
              </p>
              <p>
                {isSpanish
                  ? 'Usa esta guia para preparar mejores preguntas, registros y proximos pasos antes de abrir la ruta relacionada.'
                  : 'Use this guide to prepare better questions, records, and next steps before opening the related VestBlock path.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-4 py-10">
        <div className="container mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{isSpanish ? 'Puntos clave' : 'Key Takeaways'}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {topic.keyTakeaways.map((takeaway) => (
                  <div key={takeaway} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />
                    <p className="text-sm text-muted-foreground">{takeaway}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isSpanish ? 'Que hacer ahora' : 'What To Do Next'}</CardTitle>
                <CardDescription>
                  {isSpanish
                    ? 'Una lista simple antes de pasar a la herramienta relacionada de VestBlock.'
                    : 'A simple checklist before you move into the related VestBlock tool.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="grid gap-3">
                  {topic.actionSteps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="text-sm text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {isSpanish ? 'Preguntas frecuentes' : 'Frequently Asked Questions'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {topic.faqs.map((faq) => (
                  <div key={faq.question} className="border-b pb-4 last:border-0 last:pb-0">
                    <h2 className="font-semibold">{faq.question}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{isSpanish ? 'Guias relacionadas' : 'Related Guides'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatedTopics.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/learn/${related.slug}`}
                    className="block rounded-md border p-3 transition-colors hover:bg-muted"
                  >
                    <p className="font-medium">{related.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isSpanish
                        ? spanishClusterLabels[related.cluster] || clusterLabels[related.cluster]
                        : clusterLabels[related.cluster]}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isSpanish ? 'Usa VestBlock' : 'Use VestBlock'}</CardTitle>
                <CardDescription>
                  {isSpanish
                    ? 'Pasa de la investigacion a una accion practica de VestBlock.'
                    : 'Move from research to a practical VestBlock next step.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={topic.offerPath}>{isSpanish ? 'Abrir ruta' : 'Open Tool'}</Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </div>
  );
}
