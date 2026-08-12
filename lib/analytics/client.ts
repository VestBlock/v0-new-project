'use client';

import type { AnalyticsEventName } from '@/lib/analytics/events';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export function identifyClientUser(
  distinctId: string,
  properties?: AnalyticsProperties
) {
  void distinctId;
  void properties;
}

export function captureClientEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsProperties
) {
  void event;
  void properties;
}

export function resetClientAnalytics() {
  return;
}
