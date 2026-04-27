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

type LearnTopicPageProps = {
  params: Promise<{ slug: string }>;
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
    title: `${topic.title} Guide | VestBlock`,
    description: topic.metaDescription,
    alternates: {
      canonical: `/learn/${topic.slug}`,
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

export default async function LearnTopicPage({ params }: LearnTopicPageProps) {
  const { slug } = await params;
  const topic = getAeoTopicBySlug(slug);

  if (!topic) {
    notFound();
  }

  const relatedTopics = getRelatedAeoTopics(topic);
  const faqSchema = buildFaqSchema(topic);

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <section className="border-b bg-muted/30 px-4 py-12">
        <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{clusterLabels[topic.cluster]}</Badge>
              <Badge variant="outline">{intentLabels[topic.intent]}</Badge>
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
                  Open Related VestBlock Tool
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/learn">All Guides</Link>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Who This Helps</CardTitle>
              <CardDescription>{topic.audience}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                VestBlock provides education and workflow tools. It does not
                guarantee approvals, deletions, score changes, grants, or funding.
              </p>
              <p>
                Use this guide to prepare better questions, documents, and next
                steps before using the related tool.
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
                <CardTitle>Key Takeaways</CardTitle>
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
                <CardTitle>What To Do Next</CardTitle>
                <CardDescription>
                  A simple checklist before you move into the related VestBlock tool.
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
                <CardTitle>Frequently Asked Questions</CardTitle>
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
                <CardTitle>Related Guides</CardTitle>
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
                      {clusterLabels[related.cluster]}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Use VestBlock</CardTitle>
                <CardDescription>
                  Move from research to a real credit, funding, or business-credit
                  action.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={topic.offerPath}>Open Tool</Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </div>
  );
}
