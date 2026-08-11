'use client';

import { track } from '@vercel/analytics';
import type { AnalyticsEventName } from '@/lib/analytics/events';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const blockedPropertyPattern = /(email|phone|name|address|message|content|token|secret|password)/i;

export function captureClientEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsProperties
) {
  try {
    const safeProperties = Object.fromEntries(
      Object.entries(properties || {}).filter(([key, value]) => {
        if (blockedPropertyPattern.test(key)) return false;
        if (typeof value === 'string' && value.length > 180) return false;
        return ['string', 'number', 'boolean'].includes(typeof value) || value === null;
      })
    );

    track(event, safeProperties);
  } catch (error) {
    console.error('[analytics] capture failed:', error);
  }
}
