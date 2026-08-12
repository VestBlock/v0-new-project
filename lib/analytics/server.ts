import type { AnalyticsEventName } from '@/lib/analytics/events';

type AnalyticsProperties = Record<string, unknown>;

export async function captureServerEvent(input: {
  distinctId: string;
  event: AnalyticsEventName;
  properties?: AnalyticsProperties;
}) {
  void input;
  return false;
}

export function analyticsServerEnabled() {
  return false;
}
