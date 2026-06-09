export const vestBlockSiteName = 'VestBlock';

export const vestBlockDefaultDescription =
  'VestBlock connects sellers, buyers, lenders, developers, contractors, operators, and capital partners around real estate opportunities, DealVault records, and AEO/SEO Booster support.';

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
