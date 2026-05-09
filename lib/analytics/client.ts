'use client';

import posthog from 'posthog-js';
import type { AnalyticsEventName } from '@/lib/analytics/events';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

function isAnalyticsEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function identifyClientUser(
  distinctId: string,
  properties?: AnalyticsProperties
) {
  if (!isAnalyticsEnabled()) return;

  try {
    posthog.identify(distinctId, properties);
  } catch (error) {
    console.error('[analytics] identify failed:', error);
  }
}

export function captureClientEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsProperties
) {
  if (!isAnalyticsEnabled()) return;

  try {
    posthog.capture(event, {
      app: 'vestblock',
      runtime: 'client',
      ...properties,
    });
  } catch (error) {
    console.error('[analytics] capture failed:', error);
  }
}

export function resetClientAnalytics() {
  if (!isAnalyticsEnabled()) return;

  try {
    posthog.reset();
  } catch (error) {
    console.error('[analytics] reset failed:', error);
  }
}

