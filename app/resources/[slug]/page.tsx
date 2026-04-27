import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@supabase/supabase-js';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getVestBlockMarketingService } from '@/lib/content/marketingServices';

export const dynamic = 'force-dynamic';

type ContentAsset = {
  title: string;
  slug: string;
  service_key: string;
  language: string;
  seo_title?: string | null;
  meta_description?: string | null;
  excerpt?: string | null;
  body_markdown: string;
  cta_label?: string | null;
  cta_url?: string | null;
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

async function getPublishedAsset(slug: string) {
  const supabase = getPublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('content_assets')
    .select(
      'title,slug,service_key,language,seo_title,meta_description,excerpt,body_markdown,cta_label,cta_url,published_at'
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('content_type', 'seo_page')
    .maybeSingle();

  if (error) {
    console.warn('[resources] published content query failed:', error.message);
    return null;
  }

  return data as ContentAsset | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const asset = await getPublishedAsset(slug);

  if (!asset) {
    return {
      title: 'VestBlock Resource',
    };
  }

  return {
    title: asset.seo_title || asset.title,
    description: asset.meta_description || asset.excerpt || undefined,
    alternates: {
      canonical: `/resources/${asset.slug}`,
    },
  };
}

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const asset = await getPublishedAsset(slug);

  if (!asset) notFound();

  const service = getVestBlockMarketingService(asset.service_key);
  const ctaUrl = asset.cta_url || service.offerPath;
  const ctaLabel = asset.cta_label || `Start with ${service.label}`;

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b">
        <div className="container mx-auto max-w-4xl px-4 pb-10 pt-24 md:pt-28">
          <Badge variant="outline" className="mb-4">
            {service.label}
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {asset.title}
          </h1>
          {asset.excerpt && (
            <p className="mt-5 text-lg text-muted-foreground">{asset.excerpt}</p>
          )}
          <div className="mt-7">
            <Button asChild>
              <Link href={ctaUrl}>
                {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <article className="container mx-auto max-w-4xl px-4 py-10">
        <div className="prose prose-neutral max-w-none dark:prose-invert prose-headings:tracking-tight prose-a:text-cyan-600">
          <ReactMarkdown>{asset.body_markdown}</ReactMarkdown>
        </div>

        <div className="mt-10 rounded-lg border bg-muted/30 p-5">
          <p className="font-medium">Ready for the next step?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            VestBlock connects this topic to a practical tool or workflow so you
            can act on it.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href={ctaUrl}>
              {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </article>
    </main>
  );
}
