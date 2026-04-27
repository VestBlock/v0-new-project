import type { MetadataRoute } from 'next';
import { vestblockAeoTopics } from '@/lib/aeo/topics';

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WEB_HOST_URL ||
    'https://www.vestblock.io'
  ).replace(/\/$/, '');
}

const publicRoutes = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/learn', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/credit-upload', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/funding', priority: 0.85, changeFrequency: 'weekly' },
  { path: '/tools/business-credit', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/tools/grants', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/super-dispute', priority: 0.75, changeFrequency: 'monthly' },
  { path: '/tools/dispute-letters', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/real-estate-funding', priority: 0.65, changeFrequency: 'monthly' },
  { path: '/ai-assistant', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/sell', priority: 0.55, changeFrequency: 'monthly' },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  return [
    ...publicRoutes.map((route) => ({
      url: `${siteUrl}${route.path}`,
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...vestblockAeoTopics.map((topic) => ({
      url: `${siteUrl}/learn/${topic.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: topic.intent === 'lead-capture' ? 0.8 : 0.7,
    })),
  ];
}
