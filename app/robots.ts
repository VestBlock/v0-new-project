import type { MetadataRoute } from 'next';

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

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/llms.txt',
          '/services',
          '/dealvault',
          '/pricing',
          '/learn',
          '/funding',
          '/visibility-expansion',
          '/business-setup',
          '/es',
          '/resources',
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
          '/credit-upload',
          '/enhanced-credit-analyzer',
          '/profile',
          '/roadmap',
          '/user-hub',
          '/tools/',
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
