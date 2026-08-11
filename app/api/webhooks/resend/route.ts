import { NextResponse } from 'next/server';
import { Resend, type WebhookEventPayload } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  extractReplyCorrelationIds,
  processInboundReply,
  suppressProviderRecipient,
} from '@/lib/email/inboundOperations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_EVENT_TYPES = new Set([
  'email.sent',
  'email.scheduled',
  'email.delivered',
  'email.delivery_delayed',
  'email.complained',
  'email.bounced',
  'email.opened',
  'email.clicked',
  'email.received',
  'email.failed',
  'email.suppressed',
]);

function deliveryStatus(type: string) {
  const statuses: Record<string, string> = {
    'email.sent': 'sent',
    'email.scheduled': 'scheduled',
    'email.delivered': 'delivered',
    'email.delivery_delayed': 'delayed',
    'email.complained': 'complained',
    'email.bounced': 'bounced',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.received': 'received',
    'email.failed': 'failed',
    'email.suppressed': 'suppressed',
    'suppression.added': 'suppressed',
    'suppression.removed': 'suppression_removed',
  };
  return statuses[type] || 'recorded';
}

function eventReason(event: WebhookEventPayload) {
  if (event.type === 'email.bounced') return event.data.bounce?.message || 'bounce';
  if (event.type === 'email.failed') return event.data.failed?.reason || 'failed';
  if (event.type === 'email.suppressed') {
    return event.data.suppressed?.message || event.data.suppressed?.type || 'suppressed';
  }
  if (event.type === 'suppression.added') return event.data.origin;
  return null;
}

function providerMessageId(event: WebhookEventPayload) {
  if ('email_id' in event.data) return event.data.email_id;
  if ('source_id' in event.data) return event.data.source_id || event.data.id;
  if ('id' in event.data) return event.data.id;
  return `resend-${event.type}-${event.created_at}`;
}

function eventRecipient(event: WebhookEventPayload) {
  if (event.type === 'email.received') return event.data.from;
  if (EMAIL_EVENT_TYPES.has(event.type) && 'to' in event.data) {
    return event.data.to[0] || null;
  }
  if (event.type === 'suppression.added' || event.type === 'suppression.removed') {
    return event.data.email;
  }
  return null;
}

function eventSubject(event: WebhookEventPayload) {
  return EMAIL_EVENT_TYPES.has(event.type) && 'subject' in event.data
    ? event.data.subject
    : null;
}

function safeMetadata(event: WebhookEventPayload) {
  if (event.type === 'email.received') {
    return {
      message_id: event.data.message_id,
      received_for: event.data.received_for,
      attachment_count: event.data.attachments.length,
    };
  }
  if (event.type === 'email.bounced') {
    return {
      message_id: event.data.message_id,
      bounce_type: event.data.bounce?.type,
      bounce_subtype: event.data.bounce?.subType,
    };
  }
  if (event.type === 'email.failed') {
    return { message_id: event.data.message_id, failed_reason: event.data.failed?.reason };
  }
  if (event.type === 'email.suppressed') {
    return {
      message_id: event.data.message_id,
      suppression_type: event.data.suppressed?.type,
    };
  }
  if (EMAIL_EVENT_TYPES.has(event.type) && 'message_id' in event.data) {
    return { message_id: event.data.message_id };
  }
  if (event.type === 'suppression.added' || event.type === 'suppression.removed') {
    return { origin: event.data.origin, source_id: event.data.source_id };
  }
  return {};
}

function receivedHeader(
  headers: Record<string, string> | null | undefined,
  name: string
) {
  const match = Object.entries(headers || {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  );
  return match?.[1] || null;
}

async function updateMatchingSendEvents(
  admin: ReturnType<typeof createAdminClient>,
  messageId: string,
  status: string,
  reason: string | null
) {
  const lookups = await Promise.all([
    admin
      .from('outreach_send_events')
      .select('id')
      .contains('metadata_json', { providerMessageId: messageId })
      .limit(100),
    admin
      .from('outreach_send_events')
      .select('id')
      .contains('metadata_json', { provider_message_id: messageId })
      .limit(100),
  ]);
  for (const lookup of lookups) {
    if (lookup.error) throw lookup.error;
  }
  const ids = [
    ...new Set(
      lookups.flatMap((lookup) => (lookup.data || []).map((row) => String(row.id)))
    ),
  ];
  if (!ids.length) return 0;

  const { error } = await admin
    .from('outreach_send_events')
    .update({ status, error_message: reason })
    .in('id', ids);
  if (error) throw error;
  return ids.length;
}

async function recordProviderEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: WebhookEventPayload,
  svixId: string
) {
  const { data: existing, error: lookupError } = await admin
    .from('provider_delivery_events')
    .select('id,delivery_status')
    .eq('provider', 'resend')
    .eq('provider_event_id', svixId)
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id) {
    return {
      duplicate: existing.delivery_status === 'processed' || existing.delivery_status === deliveryStatus(event.type),
      id: existing.id as string,
    };
  }

  const messageId = providerMessageId(event);
  const { data, error } = await admin
    .from('provider_delivery_events')
    .insert({
      provider: 'resend',
      provider_event_id: svixId,
      provider_message_id: messageId,
      event_type: event.type,
      delivery_status: 'processing',
      recipient: eventRecipient(event),
      subject: eventSubject(event),
      reason: eventReason(event),
      metadata_json: safeMetadata(event),
      occurred_at: event.created_at,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { duplicate: false, id: data.id as string };
}

async function processVerifiedEvent(
  event: WebhookEventPayload,
  svixId: string,
  resend: Resend
) {
  const admin = createAdminClient();
  const providerEvent = await recordProviderEvent(admin, event, svixId);
  if (providerEvent.duplicate) {
    return { ok: true, duplicate: true, eventType: event.type };
  }

  const messageId = providerMessageId(event);
  if (EMAIL_EVENT_TYPES.has(event.type) && event.type !== 'email.received') {
    await updateMatchingSendEvents(
      admin,
      messageId,
      deliveryStatus(event.type),
      eventReason(event)
    );
  }

  if (
    event.type === 'email.bounced' ||
    event.type === 'email.complained' ||
    event.type === 'email.suppressed'
  ) {
    const reason =
      event.type === 'email.bounced'
        ? 'bounce'
        : event.type === 'email.complained'
          ? 'complaint'
          : 'provider_suppression';
    for (const recipient of event.data.to) {
      await suppressProviderRecipient(admin, { email: recipient, reason });
    }
  }

  if (event.type === 'suppression.added') {
    await suppressProviderRecipient(admin, {
      email: event.data.email,
      reason:
        event.data.origin === 'bounce'
          ? 'bounce'
          : event.data.origin === 'complaint'
            ? 'complaint'
            : 'provider_suppression',
    });
  }

  if (event.type === 'email.received') {
    const { data: received, error } = await resend.emails.receiving.get(
      event.data.email_id,
      { html_format: 'cid' }
    );
    if (error || !received) {
      throw new Error(
        `Resend receiving lookup failed for ${event.data.email_id}: ${
          error?.message || 'empty response'
        }`
      );
    }

    const mailbox =
      received.received_for[0] || received.to[0] || event.data.received_for[0];
    const result = await processInboundReply(admin, {
      provider: 'resend',
      providerEventId: svixId,
      providerMessageId: received.message_id || received.id,
      mailbox,
      fromEmail: received.from,
      toEmail: received.to[0] || null,
      subject: received.subject,
      text: received.text,
      html: received.html,
      receivedAt: received.created_at,
      threadId: receivedHeader(received.headers, 'thread-id'),
      correlationIds: extractReplyCorrelationIds(
        receivedHeader(received.headers, 'in-reply-to'),
        receivedHeader(received.headers, 'references'),
        receivedHeader(received.headers, 'thread-id')
      ),
    });

    const { error: updateError } = await admin
      .from('provider_delivery_events')
      .update({
        delivery_status: 'processed',
        metadata_json: {
          ...safeMetadata(event),
          reply_memory_id: result.replyMemoryId,
          classification: result.classification,
          lead_id: result.leadId,
          outbound_correlated: result.outboundCorrelated,
          sequence_action: result.sequenceAction,
        },
      })
      .eq('id', providerEvent.id);
    if (updateError) throw updateError;

    return {
      ok: true,
      duplicate: false,
      eventType: event.type,
      classification: result.classification,
      matchedLead: Boolean(result.leadId),
    };
  }

  const { error: finishError } = await admin
    .from('provider_delivery_events')
    .update({ delivery_status: deliveryStatus(event.type) })
    .eq('id', providerEvent.id);
  if (finishError) throw finishError;

  return { ok: true, duplicate: false, eventType: event.type };
}

export async function POST(request: Request) {
  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { ok: false, error: 'Missing webhook signature headers.' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!webhookSecret || !apiKey) {
    console.error('[resend-webhook] Verification or API configuration is missing.');
    return NextResponse.json(
      { ok: false, error: 'Webhook verification is not configured.' },
      { status: 503 }
    );
  }

  const payload = await request.text();
  const resend = new Resend(apiKey);
  let event: WebhookEventPayload;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret,
    });
  } catch {
    console.warn('[resend-webhook] Rejected an invalid webhook signature.');
    return NextResponse.json(
      { ok: false, error: 'Invalid webhook signature.' },
      { status: 400 }
    );
  }

  try {
    const result = await processVerifiedEvent(event, svixId, resend);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[resend-webhook] Event processing failed.', {
      svixId,
      eventType: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      const admin = createAdminClient();
      await admin
        .from('provider_delivery_events')
        .update({
          delivery_status: 'processing_failed',
          reason: error instanceof Error ? error.message.slice(0, 500) : 'Unknown processing failure',
        })
        .eq('provider', 'resend')
        .eq('provider_event_id', svixId);
    } catch (statusError) {
      console.error('[resend-webhook] Could not record processing failure.', {
        svixId,
        error: statusError instanceof Error ? statusError.message : String(statusError),
      });
    }
    return NextResponse.json(
      { ok: false, error: 'Webhook processing failed.' },
      { status: 500 }
    );
  }
}
