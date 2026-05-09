import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
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
  intentLabels,
  vestblockAeoTopics,
  type AeoTopic,
} from '@/lib/aeo/topics';

export const metadata: Metadata = {
  title: 'Credit Repair, Business Credit, And Funding Guides | VestBlock',
  description:
    'Practical VestBlock guides for AI credit repair, dispute letters, business credit, funding preparation, grants, and credit builder tools.',
};

function topicsByCluster() {
  return vestblockAeoTopics.reduce(
    (groups, topic) => {
      if (!groups[topic.cluster]) groups[topic.cluster] = [];
      groups[topic.cluster].push(topic);
      return groups;
    },
    {} as Record<AeoTopic['cluster'], AeoTopic[]>
  );
}

export default function LearnPage() {
  const groupedTopics = topicsByCluster();

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b bg-muted/30 px-4 py-12">
        <div className="container mx-auto max-w-6xl space-y-5">
          <Badge variant="outline" className="w-fit">
            VestBlock Learning Center
          </Badge>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Practical credit repair, funding, and business credit guides
            </h1>
            <p className="text-lg text-muted-foreground">
              Short, useful explainers that connect education to the tools inside
              VestBlock. No guaranteed score promises, no fake shortcuts, and no
              thin SEO clutter.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/credit-upload">
                Upload A Credit Report
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/funding">Explore Funding</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 py-10">
        <div className="container mx-auto grid max-w-6xl gap-6">
          {Object.entries(groupedTopics).map(([cluster, topics]) => (
            <div key={cluster} className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-cyan-600" />
                <h2 className="text-2xl font-semibold">
                  {clusterLabels[cluster as AeoTopic['cluster']]}
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {topics.map((topic) => (
                  <Card key={topic.slug}>
                    <CardHeader>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{intentLabels[topic.intent]}</Badge>
                        <Badge variant="outline">
                          {clusterLabels[topic.cluster]}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl">{topic.title}</CardTitle>
                      <CardDescription>{topic.metaDescription}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">
                        {topic.audience}
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/learn/${topic.slug}`}>
                          <Search className="mr-2 h-4 w-4" />
                          Read
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
