import { PostHog } from 'posthog-node';
import type { AnalyticsEventName } from '@/lib/analytics/events';

type AnalyticsProperties = Record<string, unknown>;

declare global {
  var __vestblockPosthog__: PostHog | undefined;
}

function getPosthogKey() {
  return (
    process.env.POSTHOG_API_KEY ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    ''
  ).trim();
}

function getPosthogHost() {
  return (
    process.env.POSTHOG_HOST ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST ||
    'https://us.i.posthog.com'
  ).trim();
}

function getPosthogClient() {
  const key = getPosthogKey();
  if (!key) return null;

  if (!globalThis.__vestblockPosthog__) {
    globalThis.__vestblockPosthog__ = new PostHog(key, {
      host: getPosthogHost(),
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return globalThis.__vestblockPosthog__;
}

export async function captureServerEvent(input: {
  distinctId: string;
  event: AnalyticsEventName;
  properties?: AnalyticsProperties;
}) {
  const client = getPosthogClient();
  if (!client) return false;

  try {
    client.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: {
        app: 'vestblock',
        runtime: 'server',
        ...input.properties,
      },
    });
    await client.flush();
    return true;
  } catch (error) {
    console.error('[analytics] server capture failed:', error);
    return false;
  }
}

export function analyticsServerEnabled() {
  return Boolean(getPosthogKey());
}

