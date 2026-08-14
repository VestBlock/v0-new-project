export const vestBlockSiteName = 'VestBlock';

export const vestBlockDefaultTitle = 'VestBlock | Find Your Next Move';

export const vestBlockDefaultDescription =
  'VestBlock is an AI-guided platform that helps people and businesses prepare, organize, and coordinate next moves across capital, real estate, opportunity, and DealVault.';

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
