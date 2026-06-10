import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { vestblockAeoTopics } from '@/lib/aeo/topics';
import { serviceSeoPages } from '@/lib/seo/serviceSeoPages';

export const dynamic = 'force-dynamic';

function getSiteUrl() {
  const configured = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WEB_HOST_URL ||
    'https://www.vestblock.io'
  ).replace(/\/$/, '');

  try {
    return new URL(configured).origin;
  } catch {
    return 'https://www.vestblock.io';
  }
}

const publicRoutes = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/llms.txt', priority: 0.4, changeFrequency: 'weekly' },
  { path: '/services', priority: 0.92, changeFrequency: 'weekly' },
  { path: '/dealvault', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/dealvault/demo', priority: 0.91, changeFrequency: 'weekly' },
  { path: '/dealvault/demo-record', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/smart-contracts', priority: 0.89, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.88, changeFrequency: 'weekly' },
  { path: '/services/financial-growth', priority: 0.86, changeFrequency: 'weekly' },
  { path: '/visibility-expansion', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/visibility-expansion/case-study', priority: 0.86, changeFrequency: 'weekly' },
  { path: '/visibility-expansion/proof-hub', priority: 0.87, changeFrequency: 'weekly' },
  { path: '/learn', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/resources', priority: 0.76, changeFrequency: 'weekly' },
  { path: '/funding', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/funding/business-funding-strategy', priority: 0.82, changeFrequency: 'weekly' },
  { path: '/business-setup', priority: 0.82, changeFrequency: 'weekly' },
  { path: '/es/vestblock', priority: 0.84, changeFrequency: 'weekly' },
  { path: '/real-estate-funding', priority: 0.87, changeFrequency: 'weekly' },
  { path: '/property-analyzer', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/calculators', priority: 0.84, changeFrequency: 'weekly' },
  { path: '/buyers', priority: 0.88, changeFrequency: 'weekly' },
  { path: '/lenders', priority: 0.87, changeFrequency: 'weekly' },
  { path: '/sell', priority: 0.86, changeFrequency: 'weekly' },
  { path: '/sell/milwaukee', priority: 0.88, changeFrequency: 'weekly' },
  { path: '/sell/toledo', priority: 0.88, changeFrequency: 'weekly' },
  { path: '/sell/memphis', priority: 0.88, changeFrequency: 'weekly' },
  { path: '/dealflow-growth-system', priority: 0.86, changeFrequency: 'weekly' },
  { path: '/proof', priority: 0.84, changeFrequency: 'weekly' },
  { path: '/ai-assistant', priority: 0.72, changeFrequency: 'monthly' },
] as const;

async function getPublishedResourceRoutes(siteUrl: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return [];

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase
      .from('content_assets')
      .select('slug,updated_at,published_at')
      .eq('status', 'published')
      .eq('content_type', 'seo_page')
      .order('published_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('[sitemap] content_assets unavailable:', error.message);
      return [];
    }

    return (data || []).map((asset) => ({
      url: `${siteUrl}/resources/${asset.slug}`,
      lastModified: asset.updated_at || asset.published_at || new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.72,
    }));
  } catch (error) {
    console.warn(
      '[sitemap] unable to load published resources:',
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const publishedResources = await getPublishedResourceRoutes(siteUrl);

  return [
    ...publicRoutes.map((route) => ({
      url: `${siteUrl}${route.path}`,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...vestblockAeoTopics.map((topic) => ({
      url: `${siteUrl}/learn/${topic.slug}`,
      changeFrequency: 'monthly' as const,
      priority: topic.intent === 'lead-capture' ? 0.8 : 0.7,
    })),
    ...serviceSeoPages.map((page) => ({
      url: `${siteUrl}/services/${page.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.76,
    })),
    ...publishedResources,
  ];
}
