import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  classifyReply,
  plainTextFromReply,
  summarizeReply,
  suggestedReplyFor,
  type ReplyClassification,
  type ReplyDecision,
} from './replyClassification';

export type InboundProvider = 'resend' | 'gmail' | 'operator' | 'test';

export type InboundReplyInput = {
  provider: InboundProvider;
  providerEventId: string;
  providerMessageId: string;
  mailbox: string;
  fromEmail: string;
  toEmail?: string | null;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  receivedAt?: string | null;
  threadId?: string | null;
  correlationIds?: string[] | null;
  classificationOverride?: ReplyClassification | null;
};

export type InboundReplyResult = {
  duplicate: boolean;
  replyMemoryId: string | null;
  commandCenterEventId: string | null;
  taskId: string | null;
  suppressionId: string | null;
  leadId: string | null;
  enrollmentId: string | null;
  strategyKey: string | null;
  outboundCorrelated: boolean;
  classification: ReplyClassification;
  sequenceAction: ReplyDecision['sequenceAction'];
  suggestedReply: string | null;
};

type Row = Record<string, any>;

const CORRELATION_REQUIRED_PROVIDERS = new Set<InboundProvider>([
  'resend',
  'gmail',
]);

export function normalizeMessageReference(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/^references?:\s*/i, '')
    .replace(/^in-reply-to:\s*/i, '')
    .replace(/^<|>$/g, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()
    .toLowerCase();
}

export function extractReplyCorrelationIds(...values: unknown[]) {
  const ids = values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .flatMap((value) => String(value || '').split(/[\s,]+/))
    .map(normalizeMessageReference)
    .filter(Boolean);
  return [...new Set(ids)];
}

export function requiresOutboundCorrelation(provider: InboundProvider) {
  return CORRELATION_REQUIRED_PROVIDERS.has(provider);
}

function normalizeEmail(value: string | null | undefined) {
  const source = String(value || '').trim();
  const bracketed = source.match(/<([^>]+)>/);
  const candidate = (bracketed?.[1] || source).trim().toLowerCase();
  return candidate.replace(/^mailto:/, '');
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function dueAtFor(decision: ReplyDecision, receivedAt: string) {
  const base = Number.isFinite(Date.parse(receivedAt))
    ? Date.parse(receivedAt)
    : Date.now();
  const days = decision.classification === 'not_now' ? 14 : 1;
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
}

function eventPriority(priority: ReplyDecision['priority']) {
  if (priority === 'urgent') return 'critical';
  if (priority === 'high') return 'warning';
  return 'info';
}

function taskPriority(priority: ReplyDecision['priority']) {
  if (priority === 'urgent') return 'urgent';
  if (priority === 'high') return 'high';
  if (priority === 'low') return 'low';
  return 'normal';
}

function replyTitle(classification: ReplyClassification) {
  const titles: Record<ReplyClassification, string> = {
    positive_interested: 'Interested reply needs attention',
    requesting_more_information: 'Contact requested more information',
    price_terms_provided: 'Price or terms reply needs review',
    call_requested: 'Contact requested a call',
    not_now: 'Contact asked to pause outreach',
    follow_up_later: 'Contact requested a later follow-up',
    not_interested: 'Contact declined outreach',
    wrong_person: 'Contact match is incorrect',
    property_sold: 'Property was reported sold',
    already_funded: 'Funding need was reported resolved',
    unsubscribe: 'Unsubscribe request processed',
    auto_reply: 'Automated reply paused the sequence',
    bounce: 'Email address bounced',
    spam_irrelevant: 'Irrelevant reply filtered',
    needs_human_review: 'Reply needs human classification',
  };
  return titles[classification];
}

function replyMemoryClassification(classification: ReplyClassification) {
  if (classification === 'spam_irrelevant') return 'spam_noise';
  if (['bounce', 'unsubscribe', 'wrong_person'].includes(classification)) {
    return 'operational_alert';
  }
  if (
    [
      'positive_interested',
      'requesting_more_information',
      'price_terms_provided',
      'call_requested',
      'follow_up_later',
      'needs_human_review',
    ].includes(classification)
  ) {
    return 'hot_seller_lead';
  }
  return 'low_priority';
}

function rowCorrelationIds(row: Row | null | undefined) {
  const metadata = row?.metadata_json || {};
  return extractReplyCorrelationIds(
    row?.last_message_id,
    row?.outreach_message_id,
    row?.provider_message_id,
    row?.message_id,
    metadata.providerMessageId,
    metadata.provider_message_id,
    metadata.messageId,
    metadata.message_id,
    metadata.gmailMessageId,
    metadata.gmail_message_id,
    metadata.threadId,
    metadata.thread_id
  );
}

function matchingCorrelationId(row: Row | null | undefined, candidates: Set<string>) {
  return rowCorrelationIds(row).find((id) => candidates.has(id)) || null;
}

async function findContext(
  admin: SupabaseClient,
  input: InboundReplyInput,
  fromEmail: string
) {
  const correlationRequired = requiresOutboundCorrelation(input.provider);
  const requestedCorrelations = new Set(
    extractReplyCorrelationIds(input.correlationIds || [], input.threadId)
  );

  // Resend lifecycle events connect an RFC Message-ID from In-Reply-To/References
  // to the provider email ID stored by outbound senders.
  if (input.provider === 'resend' && requestedCorrelations.size > 0) {
    const { data: providerEvents, error } = await admin
      .from('provider_delivery_events')
      .select('provider_message_id,recipient,metadata_json,occurred_at')
      .eq('provider', 'resend')
      .ilike('recipient', fromEmail)
      .order('occurred_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    for (const providerEvent of providerEvents || []) {
      if (!matchingCorrelationId(providerEvent as Row, requestedCorrelations)) continue;
      for (const id of rowCorrelationIds(providerEvent as Row)) {
        requestedCorrelations.add(id);
      }
    }
  }

  const { data: enrollmentRows, error: enrollmentError } = await admin
    .from('command_center_outbound_enrollments')
    .select(
      'id,campaign_run_id,lead_id,strategy_key,recipient,market,property_address,status,last_message_id,metadata_json,updated_at'
    )
    .ilike('recipient', fromEmail)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (enrollmentError) throw enrollmentError;

  const { data: sendEventRows, error: sendEventError } = await admin
    .from('outreach_send_events')
    .select(
      'id,lead_id,outreach_message_id,channel,provider,status,recipient,subject,metadata_json,created_at'
    )
    .ilike('recipient', fromEmail)
    .order('created_at', { ascending: false })
    .limit(100);
  if (sendEventError) throw sendEventError;

  const matchingEnrollments = correlationRequired
    ? (enrollmentRows || []).filter((row: Row) =>
        Boolean(matchingCorrelationId(row, requestedCorrelations))
      )
    : [];
  const matchingSendEvents = correlationRequired
    ? (sendEventRows || []).filter((row: Row) =>
        Boolean(matchingCorrelationId(row, requestedCorrelations))
      )
    : [];
  const matchedLeadIds = new Set(
    [...matchingEnrollments, ...matchingSendEvents]
      .map((row: Row) => String(row.lead_id || '').trim())
      .filter(Boolean)
  );
  const ambiguous =
    correlationRequired &&
    (matchingEnrollments.length > 1 ||
      matchingSendEvents.length > 1 ||
      matchedLeadIds.size > 1);
  const enrollment = correlationRequired
    ? ambiguous
      ? null
      : matchingEnrollments[0] || null
    : enrollmentRows?.[0] || null;
  const sendEvent = correlationRequired
    ? ambiguous
      ? null
      : matchingSendEvents[0] || null
    : sendEventRows?.[0] || null;
  const correlationId =
    matchingCorrelationId(enrollment as Row | null, requestedCorrelations) ||
    matchingCorrelationId(sendEvent as Row | null, requestedCorrelations);
  const outboundCorrelated =
    !correlationRequired || (!ambiguous && Boolean(correlationId));

  let lead: Row | null = null;
  if (enrollment?.lead_id) {
    const { data, error } = await admin
      .from('leads')
      .select(
        'id,name,email,status,outreach_status,source,campaign_name,property_address,city,state,metadata_json,updated_at'
      )
      .eq('id', enrollment.lead_id)
      .maybeSingle();
    if (error) throw error;
    lead = data;
  }

  if (!lead && sendEvent?.lead_id) {
    const { data, error } = await admin
      .from('leads')
      .select(
        'id,name,email,status,outreach_status,source,campaign_name,property_address,city,state,metadata_json,updated_at'
      )
      .eq('id', sendEvent.lead_id)
      .maybeSingle();
    if (error) throw error;
    lead = data;
  }

  if (!lead && !correlationRequired) {
    const { data, error } = await admin
      .from('leads')
      .select(
        'id,name,email,status,outreach_status,source,campaign_name,property_address,city,state,metadata_json,updated_at'
      )
      .ilike('email', fromEmail)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    lead = data;
  }

  return {
    enrollment: enrollment as Row | null,
    lead,
    sendEvent: sendEvent as Row | null,
    outboundCorrelated,
    correlationId,
    correlationStatus: !correlationRequired
      ? 'trusted_local'
      : ambiguous
        ? 'ambiguous'
        : correlationId
          ? 'matched'
          : 'unmatched',
  };
}

function requireHumanCorrelationReview(
  detected: ReplyDecision,
  correlationStatus: 'ambiguous' | 'unmatched'
): ReplyDecision {
  return {
    classification: 'needs_human_review',
    confidence: 1,
    reasons: [
      correlationStatus === 'ambiguous'
        ? 'More than one VestBlock outbound context matched this inbound email, so attribution was not safe.'
        : 'No verified VestBlock outbound message or thread matched this inbound email.',
      `Content-only classification was ${detected.classification}; no lead, enrollment, or suppression state was changed.`,
    ],
    sequenceAction: 'pause',
    globalSuppress: false,
    createTask: true,
    priority: 'high',
    leadStatus: null,
    outreachStatus: null,
    nextStep: 'Verify the outbound conversation link before changing contact or sequence state.',
  };
}

async function ensureSuppression(
  admin: SupabaseClient,
  email: string,
  reason: string,
  now: string
) {
  const { data: existing, error: lookupError } = await admin
    .from('lead_suppressions')
    .select('id,status,reason')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing?.id) {
    const { error } = await admin
      .from('lead_suppressions')
      .update({ status: 'active', reason, updated_at: now })
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id as string;
  }

  const { data, error } = await admin
    .from('lead_suppressions')
    .insert({ email, reason, status: 'active', created_at: now, updated_at: now })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function suppressProviderRecipient(
  admin: SupabaseClient,
  input: {
    email: string;
    reason: 'bounce' | 'complaint' | 'provider_suppression';
    now?: string;
  }
) {
  const email = normalizeEmail(input.email);
  if (!validEmail(email)) return { suppressionId: null, leadIds: [] as string[] };
  const now = input.now || new Date().toISOString();
  const suppressionId = await ensureSuppression(admin, email, input.reason, now);

  const { data: leads, error: leadLookupError } = await admin
    .from('leads')
    .select('id')
    .ilike('email', email)
    .limit(100);
  if (leadLookupError) throw leadLookupError;

  const leadIds = (leads || []).map((lead: Row) => String(lead.id));
  if (leadIds.length) {
    const { error } = await admin
      .from('leads')
      .update({
        status: input.reason === 'bounce' ? 'disqualified' : 'do_not_contact',
        outreach_status: 'do_not_contact',
        delivery_status: input.reason === 'bounce' ? 'bounced' : 'suppressed',
        suppression_reason: input.reason,
        next_follow_up_at: null,
        updated_at: now,
      })
      .in('id', leadIds);
    if (error) throw error;
  }

  const { error: enrollmentError } = await admin
    .from('command_center_outbound_enrollments')
    .update({
      status: 'suppressed',
      suppression_reason: input.reason,
      next_action_at: null,
      updated_at: now,
    })
    .ilike('recipient', email);
  if (enrollmentError) throw enrollmentError;

  return { suppressionId, leadIds };
}

export async function processInboundReply(
  admin: SupabaseClient,
  rawInput: InboundReplyInput
): Promise<InboundReplyResult> {
  const fromEmail = normalizeEmail(rawInput.fromEmail);
  const mailbox = normalizeEmail(rawInput.mailbox);
  const toEmail = normalizeEmail(rawInput.toEmail || mailbox);
  if (!validEmail(fromEmail)) throw new Error('Inbound reply sender is not a valid email address.');
  if (!rawInput.providerMessageId.trim()) {
    throw new Error('Inbound reply is missing a provider message ID.');
  }

  const receivedAt = rawInput.receivedAt && Number.isFinite(Date.parse(rawInput.receivedAt))
    ? new Date(rawInput.receivedAt).toISOString()
    : new Date().toISOString();
  const now = new Date().toISOString();
  const detectedDecision = classifyReply({
    fromEmail,
    subject: rawInput.subject,
    text: rawInput.text,
    html: rawInput.html,
    classificationOverride: rawInput.classificationOverride,
  });

  const { data: existingReply, error: duplicateError } = await admin
    .from('command_center_reply_memory')
    .select('id,command_center_event_id,lead_id,strategy_key,classification,metadata_json')
    .eq('mailbox', mailbox || toEmail || 'unknown')
    .eq('message_id', rawInput.providerMessageId)
    .limit(1)
    .maybeSingle();
  if (duplicateError) throw duplicateError;

  if (existingReply?.id) {
    return {
      duplicate: true,
      replyMemoryId: existingReply.id,
      commandCenterEventId: existingReply.command_center_event_id || null,
      taskId: existingReply.metadata_json?.task_id || null,
      suppressionId: existingReply.metadata_json?.suppression_id || null,
      leadId: existingReply.lead_id || null,
      enrollmentId: existingReply.metadata_json?.enrollment_id || null,
      strategyKey: existingReply.strategy_key || null,
      outboundCorrelated: existingReply.metadata_json?.outbound_correlated !== false,
      classification:
        (existingReply.metadata_json?.reply_classification as ReplyClassification) ||
        'needs_human_review',
      sequenceAction: existingReply.metadata_json?.sequence_action || 'pause',
      suggestedReply: existingReply.metadata_json?.suggested_reply || null,
    };
  }

  const context = await findContext(admin, rawInput, fromEmail);
  const decision = context.outboundCorrelated
    ? detectedDecision
    : requireHumanCorrelationReview(
        detectedDecision,
        context.correlationStatus === 'ambiguous' ? 'ambiguous' : 'unmatched'
      );
  const lead = context.lead;
  const enrollment = context.enrollment;
  const sendEvent = context.sendEvent;
  const leadId = String(lead?.id || enrollment?.lead_id || sendEvent?.lead_id || '') || null;
  const strategyKey =
    String(enrollment?.strategy_key || lead?.campaign_name || lead?.source || '').trim() ||
    null;
  const propertyAddress =
    String(enrollment?.property_address || lead?.property_address || '').trim() || null;
  const market =
    String(
      enrollment?.market ||
        [lead?.city, lead?.state].filter(Boolean).join(', ')
    ).trim() || null;
  const firstName = String(lead?.name || '').trim().split(/\s+/)[0] || null;
  const replySummary = summarizeReply({ text: rawInput.text, html: rawInput.html });
  const suggestedReply = suggestedReplyFor(decision.classification, {
    firstName,
    propertyAddress,
  });
  const bodyHash = createHash('sha256')
    .update(plainTextFromReply({ text: rawInput.text, html: rawInput.html }))
    .digest('hex');

  const { data: priorEvent, error: priorEventError } = await admin
    .from('command_center_events')
    .select('id')
    .contains('metadata_json', {
      provider: rawInput.provider,
      provider_message_id: rawInput.providerMessageId,
    })
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorEventError) throw priorEventError;

  let event = priorEvent as { id: string } | null;
  if (!event) {
    const { data: insertedEvent, error: eventError } = await admin
      .from('command_center_events')
      .insert({
        event_type: 'email.replied',
        entity_type: leadId ? 'lead' : 'email_contact',
        entity_id: leadId || fromEmail,
        source: `${rawInput.provider}_inbound`,
        title: replyTitle(decision.classification),
        summary: replySummary,
        priority: eventPriority(decision.priority),
        status: decision.createTask ? 'open' : 'resolved',
        occurred_at: receivedAt,
        metadata_json: {
          provider: rawInput.provider,
          provider_event_id: rawInput.providerEventId,
          provider_message_id: rawInput.providerMessageId,
          outbound_correlated: context.outboundCorrelated,
          correlation_id: context.correlationId,
          correlation_status: context.correlationStatus,
          detected_classification: detectedDecision.classification,
          classification: decision.classification,
          confidence: decision.confidence,
          reasons: decision.reasons,
          sequence_action: decision.sequenceAction,
          enrollment_id: enrollment?.id || null,
          send_event_id: sendEvent?.id || null,
          strategy_key: strategyKey,
          campaign_run_id: enrollment?.campaign_run_id || null,
          has_suggested_reply: Boolean(suggestedReply),
        },
      })
      .select('id')
      .single();
    if (eventError) throw eventError;
    event = insertedEvent;
  }
  if (!event) throw new Error('Inbound reply event could not be created.');

  let suppressionId: string | null = null;
  if (decision.globalSuppress) {
    suppressionId = await ensureSuppression(
      admin,
      fromEmail,
      decision.classification === 'bounce'
        ? 'bounce'
        : decision.classification === 'wrong_person'
          ? 'wrong_person_reply'
          : 'unsubscribe_reply',
      now
    );
  }

  if (enrollment?.id && decision.sequenceAction !== 'continue') {
    const { error } = await admin
      .from('command_center_outbound_enrollments')
      .update({
        status: decision.globalSuppress ? 'suppressed' : 'replied',
        suppression_reason: decision.globalSuppress
          ? decision.classification
          : null,
        next_action_at:
          decision.classification === 'not_now' ||
          decision.classification === 'follow_up_later' ||
          decision.classification === 'auto_reply'
            ? dueAtFor(decision, receivedAt)
            : null,
        metadata_json: {
          ...(enrollment.metadata_json || {}),
          reply_classification: decision.classification,
          sequence_action: decision.sequenceAction,
          automation_yielded: true,
          reply_message_id: rawInput.providerMessageId,
        },
        updated_at: now,
      })
      .eq('id', enrollment.id);
    if (error) throw error;
  }

  if (leadId) {
    const patch: Row = { updated_at: now };
    if (
      decision.leadStatus &&
      (['do_not_contact', 'disqualified'].includes(decision.leadStatus) ||
        ['new', 'scored', 'outreach_ready', 'contacted', ''].includes(
          String(lead?.status || '').trim().toLowerCase()
        ))
    ) {
      patch.status = decision.leadStatus;
    }
    if (decision.outreachStatus) patch.outreach_status = decision.outreachStatus;
    if (decision.globalSuppress) {
      patch.suppression_reason = decision.classification;
      patch.next_follow_up_at = null;
      if (decision.classification === 'bounce') patch.delivery_status = 'bounced';
    } else if (
      decision.classification === 'not_now' ||
      decision.classification === 'follow_up_later' ||
      decision.classification === 'auto_reply'
    ) {
      patch.next_follow_up_at = dueAtFor(decision, receivedAt);
    } else if (decision.createTask) {
      patch.next_follow_up_at = dueAtFor(decision, receivedAt);
    }
    const { error } = await admin.from('leads').update(patch).eq('id', leadId);
    if (error) throw error;
  }

  let taskId: string | null = null;
  if (decision.createTask) {
    const entityType = leadId ? 'lead' : 'email_contact';
    const entityId = leadId || fromEmail;
    const { data: sourceTask, error: sourceTaskError } = await admin
      .from('admin_tasks')
      .select('id')
      .eq('source_event_id', event.id)
      .limit(1)
      .maybeSingle();
    if (sourceTaskError) throw sourceTaskError;
    let priorTask = sourceTask;
    if (!priorTask?.id) {
      const { data: openTask, error: openTaskError } = await admin
        .from('admin_tasks')
        .select('id')
        .eq('task_type', 'inbound_reply')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle();
      if (openTaskError) throw openTaskError;
      priorTask = openTask;
    }
    if (priorTask?.id) {
      taskId = priorTask.id;
    } else {
      const { data: task, error } = await admin
        .from('admin_tasks')
        .insert({
          title: replyTitle(decision.classification),
          description: `${replySummary}\n\nRecommended next action: ${decision.nextStep}`,
          task_type: 'inbound_reply',
          status: 'open',
          priority: taskPriority(decision.priority),
          assigned_to: 'founder',
          user_email: fromEmail,
          entity_type: entityType,
          entity_id: entityId,
          source_event_id: event.id,
          due_at: dueAtFor(decision, receivedAt),
          metadata_json: {
            reply_classification: decision.classification,
            reply_message_id: rawInput.providerMessageId,
            outbound_correlated: context.outboundCorrelated,
            correlation_id: context.correlationId,
            correlation_status: context.correlationStatus,
            detected_classification: detectedDecision.classification,
            strategy_key: strategyKey,
            enrollment_id: enrollment?.id || null,
            suggested_reply: suggestedReply,
            requires_human_approval: true,
          },
        })
        .select('id')
        .single();
      if (error) throw error;
      taskId = task.id;
    }
  }

  const { data: replyMemory, error: replyError } = await admin
    .from('command_center_reply_memory')
    .insert({
      command_center_event_id: event.id,
      lead_id: leadId,
      campaign_run_id: enrollment?.campaign_run_id || null,
      strategy_key: strategyKey,
      mailbox: mailbox || toEmail || 'unknown',
      thread_id: rawInput.threadId || null,
      message_id: rawInput.providerMessageId,
      from_email: fromEmail,
      to_email: toEmail || null,
      subject: rawInput.subject || null,
      property_address: propertyAddress,
      market,
      received_at: receivedAt,
      classification: replyMemoryClassification(decision.classification),
      next_step: decision.nextStep,
      reply_summary: replySummary,
      metadata_json: {
        provider: rawInput.provider,
        provider_event_id: rawInput.providerEventId,
        reply_classification: decision.classification,
        outbound_correlated: context.outboundCorrelated,
        correlation_id: context.correlationId,
        correlation_status: context.correlationStatus,
        detected_classification: detectedDecision.classification,
        confidence: decision.confidence,
        reasons: decision.reasons,
        sequence_action: decision.sequenceAction,
        enrollment_id: enrollment?.id || null,
        send_event_id: sendEvent?.id || null,
        task_id: taskId,
        suppression_id: suppressionId,
        suggested_reply: suggestedReply,
        requires_human_approval: Boolean(suggestedReply),
        body_sha256: bodyHash,
        body_stored: false,
      },
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (replyError) throw replyError;

  return {
    duplicate: false,
    replyMemoryId: replyMemory.id,
    commandCenterEventId: event.id,
    taskId,
    suppressionId,
    leadId,
    enrollmentId: enrollment?.id || null,
    strategyKey,
    outboundCorrelated: context.outboundCorrelated,
    classification: decision.classification,
    sequenceAction: decision.sequenceAction,
    suggestedReply,
  };
}
