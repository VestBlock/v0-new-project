import type { MetadataRoute } from 'next';

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.WEB_HOST_URL ||
    'https://www.vestblock.io'
  ).replace(/\/$/, '');
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/learn',
          '/credit-upload',
          '/funding',
          '/business-setup',
          '/es',
          '/resources',
          '/tools',
          '/super-dispute',
          '/real-estate-funding',
          '/ai-assistant',
          '/sell',
        ],
        disallow: [
          '/api/',
          '/admin-panel',
          '/admin/',
          '/dashboard',
          '/profile',
          '/user-hub',
          '/auth-debug',
          '/database-diagnostic',
          '/debug-analyzer',
          '/credit-report-debug',
          '/credit-report-diagnostic',
          '/setup-database',
          '/test-',
          '/analysis/',
          '/credit-dashboard/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
