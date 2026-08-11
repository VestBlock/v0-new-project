export type AnalyticsConfigurationStatus =
  | 'disabled'
  | 'misconfigured'
  | 'configured';

export function isPosthogProjectToken(value: string | null | undefined) {
  const token = String(value || '').trim();
  if (!token) return false;

  // PostHog personal and secret keys must never be used for event ingestion,
  // especially in NEXT_PUBLIC variables. VestBlock only accepts project tokens.
  if (token.startsWith('phx_') || token.startsWith('phs_')) return false;
  return token.startsWith('phc_') || token.startsWith('ph_');
}

export function classifyPosthogToken(value: string | null | undefined): AnalyticsConfigurationStatus {
  const token = String(value || '').trim();
  if (!token) return 'disabled';
  return isPosthogProjectToken(token) ? 'configured' : 'misconfigured';
}

export function getPublicPosthogToken() {
  const preferred = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  const legacy = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const token = preferred || legacy || '';
  return isPosthogProjectToken(token) ? token : '';
}

export function getServerPosthogToken() {
  const token =
    process.env.POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    '';
  return isPosthogProjectToken(token) ? token : '';
}

export function getPosthogConfigurationStatus() {
  const configuredValue =
    process.env.POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    process.env.POSTHOG_API_KEY?.trim() ||
    '';
  return classifyPosthogToken(configuredValue);
}
