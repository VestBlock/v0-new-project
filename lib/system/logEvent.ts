import { createAdminClient } from '@/lib/supabase/admin';

export type SystemEventType =
  | 'credit_report_uploaded'
  | 'credit_analysis_started'
  | 'credit_analysis_stalled'
  | 'credit_analysis_completed'
  | 'credit_analysis_failed'
  | 'dispute_letters_ready'
  | 'dispute_letter_mail_reminder'
  | 'dispute_secondary_bureau_reminder'
  | 'dispute_bureau_response_due'
  | 'dispute_letter_status_updated'
  | 'email_sent'
  | 'email_failed'
  | 'checkout_started'
  | 'payment_completed'
  | 'payment_failed'
  | 'abandoned_checkout'
  | 'lead_created'
  | 'lead_scrape_run'
  | 'lead_scored'
  | 'outreach_generated'
  | 'outreach_approved'
  | 'outreach_sent'
  | 'service_deliverable_generated'
  | 'service_deliverable_failed'
  | 'service_deliverable_sent'
  | 'funding_strategy_submitted'
  | 'funding_strategy_paid'
  | 'funding_strategy_status_updated'
  | 'funding_profile_saved'
  | 'funding_recommendation_generated'
  | 'funding_application_created'
  | 'funding_application_status_updated'
  | 'funding_approval_recorded'
  | 'funding_payment_plan_requested'
  | 'content_generated'
  | 'content_published'
  | 'signup_no_upload'
  | 'paid_customer_no_upload'
  | 'lead_followup_needed'
  | 'lender_scored'
  | 'lender_outreach_generated'
  | 'lender_match_generated'
  | 'lender_outreach_sent'
  | 'buyer_scored'
  | 'buyer_outreach_generated'
  | 'buyer_match_generated'
  | 'buyer_outreach_sent'
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
