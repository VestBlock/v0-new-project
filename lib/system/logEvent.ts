import { createAdminClient } from '@/lib/supabase/admin';

export type SystemEventType =
  | 'credit_report_uploaded'
  | 'credit_analysis_started'
  | 'credit_analysis_stalled'
  | 'credit_analysis_completed'
  | 'credit_analysis_failed'
  | 'email_sent'
  | 'email_failed'
  | 'payment_completed'
  | 'admin_action';

type LogEventInput = {
  eventType: SystemEventType;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logEvent(input: LogEventInput) {
  const payload = {
    actor_user_id: input.actorUserId ?? null,
    action_type: input.eventType,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata_json: input.metadata ?? {},
  };

  console.info('[vestblock-event]', payload);

  try {
    const admin = createAdminClient();
    const { error } = await admin.from('admin_activity').insert(payload);

    if (error) {
      console.warn(
        '[vestblock-event] admin_activity insert skipped:',
        error.message
      );
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[vestblock-event] logger unavailable:', message);
    return { ok: false, error: message };
  }
}
