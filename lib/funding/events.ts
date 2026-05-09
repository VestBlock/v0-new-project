import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent, type SystemEventType } from '@/lib/system/logEvent';

type FundingEventInput = {
  userId?: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
  adminEventType?: SystemEventType;
  entityId?: string | null;
};

export async function recordFundingEvent(input: FundingEventInput) {
  const admin = createAdminClient();

  const [fundingEvent] = await Promise.allSettled([
    admin.from('funding_events').insert({
      user_id: input.userId ?? null,
      event_type: input.eventType,
      metadata: input.metadata ?? {},
    }),
    input.adminEventType
      ? logEvent({
          eventType: input.adminEventType,
          actorUserId: input.userId ?? null,
          entityType: 'funding_assistant',
          entityId: input.entityId ?? null,
          metadata: {
            fundingEventType: input.eventType,
            ...(input.metadata ?? {}),
          },
        })
      : Promise.resolve(null),
  ]);

  if (fundingEvent.status === 'rejected') {
    console.warn('[funding-events] insert failed:', fundingEvent.reason);
  }
}
