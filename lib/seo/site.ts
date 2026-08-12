export const vestBlockSiteName = 'VestBlock';

export const vestBlockDefaultDescription =
  'VestBlock brings capital access, deal pathways, and opportunities to build, acquire, or grow into one coordinated place, with DealVault records supporting active work.';

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
