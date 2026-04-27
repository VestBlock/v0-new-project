export const vestBlockSiteName = 'VestBlock';

export const vestBlockDefaultDescription =
  'VestBlock helps consumers and business owners use AI credit analysis, dispute-letter tools, business funding readiness, business credit planning, grants, real estate funding, and financial prep services.';

export function getSiteUrl() {
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

export function absoluteUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

