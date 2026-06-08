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

const publicCrawlerAccess = [
  '/',
  '/llms.txt',
  '/services',
  '/dealvault',
  '/dealvault/demo',
  '/pricing',
  '/learn',
  '/funding',
  '/visibility-expansion',
  '/business-setup',
  '/es',
  '/resources',
  '/real-estate-funding',
  '/ai-assistant',
  '/sell',
  '/sell/milwaukee',
  '/sell/toledo',
  '/sell/memphis',
  '/buyers',
  '/lenders',
  '/smart-contracts',
  '/dealflow-growth-system',
  '/proof',
];

const privateAppPaths = [
  '/api/',
  '/admin-panel',
  '/admin/',
  '/dashboard',
  '/credit-upload',
  '/profile',
  '/roadmap',
  '/super-dispute',
  '/user-hub',
  '/tools/',
  '/auth-debug',
  '/database-diagnostic',
  '/credit-report-diagnostic',
  '/setup-database',
  '/analysis/',
  '/credit-dashboard/',
];

const answerEngineCrawlers = [
  'OAI-SearchBot',
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Applebot',
  'Applebot-Extended',
  'Googlebot',
  'Google-Extended',
  'GoogleOther',
  'Bingbot',
  'BingPreview',
];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: answerEngineCrawlers,
        allow: publicCrawlerAccess,
        disallow: privateAppPaths,
      },
      {
        userAgent: '*',
        allow: publicCrawlerAccess,
        disallow: privateAppPaths,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
