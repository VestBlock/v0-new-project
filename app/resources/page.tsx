import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getVestBlockMarketingService } from '@/lib/content/marketingServices';
import { absoluteUrl } from '@/lib/seo/site';
import { breadcrumbJsonLd } from '@/lib/seo/structuredData';

export const dynamic = 'force-dynamic';

type PublishedAsset = {
  title: string;
  slug: string;
  service_key: string;
  language: string;
  excerpt?: string | null;
  published_at?: string | null;
};

function getPublicClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return null;

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getLatestPublishedAssets() {
  const supabase = getPublicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('content_assets')
    .select('title,slug,service_key,language,excerpt,published_at')
    .eq('status', 'published')
    .eq('content_type', 'seo_page')
    .order('published_at', { ascending: false })
    .limit(36);

  if (error) {
    console.warn('[resources] listing query failed:', error.message);
    return [];
  }

  return (data || []) as PublishedAsset[];
}

export const metadata: Metadata = {
  title: 'VestBlock Resources',
  description:
    'Practical VestBlock guides and checklists for visibility, proof records, and small business growth.',
  alternates: {
    canonical: '/resources',
  },
  openGraph: {
    title: 'VestBlock Resources',
    description:
      'Practical VestBlock guides and checklists for visibility, proof records, and small business growth.',
    url: absoluteUrl('/resources'),
    type: 'website',
  },
};

export default async function ResourcesIndexPage() {
  const assets = await getLatestPublishedAssets();
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Resources', path: '/resources' },
  ]);

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />

      <section className="border-b">
        <div className="container mx-auto max-w-5xl px-4 pb-10 pt-24 md:pt-28">
          <Badge variant="outline" className="mb-4">
            VestBlock resource library
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Resources
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Action-ready guides and checklists. Each page maps to a VestBlock
            service or proof record so buyers and AI tools can cite it with
            confidence.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/visibility-expansion/proof-hub">
                View proof hub <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/services">
                Explore services <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-5xl px-4 py-12">
        {assets.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-6">
            <p className="font-medium">No published resources yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This page lists published content from the VestBlock content
              library. If you are running locally, set the public Supabase env
              vars so the index can load.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {assets.map((asset) => {
              const service = getVestBlockMarketingService(asset.service_key);
              const languageLabel =
                asset.language === 'es' ? 'Español' : 'English';
              return (
                <Link
                  key={asset.slug}
                  href={`/resources/${asset.slug}`}
                  className="group rounded-xl border bg-card p-6 transition hover:border-cyan-500/50 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{service.label}</Badge>
                    <Badge variant="outline">{languageLabel}</Badge>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold tracking-tight group-hover:text-cyan-600">
                    {asset.title}
                  </h2>
                  {asset.excerpt ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {asset.excerpt}
                    </p>
                  ) : null}
                  <div className="mt-4 text-sm font-medium text-cyan-700 dark:text-cyan-400">
                    Read resource <ArrowRight className="ml-1 inline h-4 w-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
