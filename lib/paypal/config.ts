export type PaypalEnvironment = 'sandbox' | 'live';

export function getPaypalEnvironment(): PaypalEnvironment {
  const value = (
    process.env.PAYPAL_ENV ||
    process.env.PAYPAL_MODE ||
    'sandbox'
  ).toLowerCase();

  if (['live', 'production', 'prod'].includes(value)) {
    return 'live';
  }

  return 'sandbox';
}

export function getPaypalApiBaseUrl() {
  return getPaypalEnvironment() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

export function getPaypalApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getPaypalApiBaseUrl()}${normalizedPath}`;
}
