import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { AnalyticsEventName } from '@/lib/analytics/events';

type AnalyticsProperties = Record<string, unknown>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const blockedPropertyPattern = /(email|phone|name|address|message|content|token|secret|password|fileName|destinationUrl)/i;

function sanitizeProperties(properties: AnalyticsProperties = {}) {
  const entries: Array<[string, string | number | boolean | null]> = [];
  for (const [key, value] of Object.entries(properties)) {
    if (blockedPropertyPattern.test(key)) continue;
    if (typeof value === 'string') {
      if (value.length <= 240 && !value.includes('@')) entries.push([key, value]);
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) entries.push([key, value]);
    if (typeof value === 'boolean' || value === null) entries.push([key, value]);
  }
  return Object.fromEntries(entries);
}

function eventEntity(properties: AnalyticsProperties = {}) {
  for (const key of ['leadId', 'paymentId', 'reportId', 'requestId', 'chatId', 'documentId']) {
    const value = properties[key];
    if (typeof value === 'string' && value.length <= 180) {
      return { entityType: key.replace(/Id$/, ''), entityId: value };
    }
  }
  return { entityType: 'analytics_event', entityId: null };
}

export async function captureServerEvent(input: {
  distinctId: string;
  event: AnalyticsEventName;
  properties?: AnalyticsProperties;
}) {
  try {
    const admin = createAdminClient();
    const entity = eventEntity(input.properties);
    const { error } = await admin.from('admin_activity').insert({
      actor_user_id: uuidPattern.test(input.distinctId) ? input.distinctId : null,
      action_type: input.event,
      entity_type: entity.entityType,
      entity_id: entity.entityId,
      metadata_json: {
        app: 'vestblock',
        runtime: 'server',
        ...sanitizeProperties(input.properties),
      },
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[analytics] server capture failed:', error);
    return false;
  }
}

export function analyticsServerStatus() {
  return 'first_party' as const;
}
