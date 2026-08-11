import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { classifyReply } from '../lib/email/replyClassification';
import {
  extractReplyCorrelationIds,
  processInboundReply,
  requiresOutboundCorrelation,
} from '../lib/email/inboundOperations';

function testClassifications() {
  const cases = [
    {
      name: 'positive reply with information request',
      input: { text: "I'm interested. Can you send me more information?" },
      expected: 'positive_interested',
    },
    {
      name: 'explicit unsubscribe overrides positive intent',
      input: { text: "I was interested, but STOP. Don't email me again." },
      expected: 'unsubscribe',
    },
    {
      name: 'negative reply',
      input: { text: 'No thanks, I am not interested.' },
      expected: 'not_interested',
    },
    {
      name: 'out of office',
      input: { subject: 'Automatic reply', text: 'I am out of the office until Monday.' },
      expected: 'auto_reply',
    },
    {
      name: 'bounce sender',
      input: {
        fromEmail: 'mailer-daemon@example.com',
        subject: 'Delivery Status Notification (Failure)',
      },
      expected: 'bounce',
    },
    {
      name: 'price terms',
      input: { text: 'Our asking price is $185,000.' },
      expected: 'price_terms_provided',
    },
    {
      name: 'ambiguous reply pauses for review',
      input: { text: 'What did you have in mind?' },
      expected: 'requesting_more_information',
    },
  ] as const;

  for (const testCase of cases) {
    const actual = classifyReply(testCase.input);
    assert.equal(
      actual.classification,
      testCase.expected,
      `${testCase.name}: expected ${testCase.expected}, received ${actual.classification}`
    );
    assert.ok(actual.reasons.length > 0, `${testCase.name}: no explanation returned`);
    if (actual.classification === 'unsubscribe') {
      assert.equal(actual.globalSuppress, true);
      assert.equal(actual.sequenceAction, 'stop');
    }
  }
  console.log(`PASS classifier: ${cases.length} explainable cases`);
}

function testCorrelationPolicy() {
  assert.equal(requiresOutboundCorrelation('resend'), true);
  assert.equal(requiresOutboundCorrelation('gmail'), true);
  assert.equal(requiresOutboundCorrelation('operator'), false);
  assert.deepEqual(
    extractReplyCorrelationIds(
      '<outbound-1@example.com>',
      '<outbound-2@example.com> <outbound-1@example.com>'
    ),
    ['outbound-1@example.com', 'outbound-2@example.com']
  );
  console.log('PASS correlation policy: external providers require verified outbound linkage');
}

async function cleanupLiveTest(
  admin: SupabaseClient,
  identifiers: {
    email: string;
    messageIds: string[];
    eventIds: string[];
    enrollmentIds: string[];
    leadId?: string;
    suppressionIds: string[];
  }
) {
  const eventIds = new Set(identifiers.eventIds);
  for (const messageId of identifiers.messageIds) {
    const { data } = await admin
      .from('command_center_events')
      .select('id')
      .contains('metadata_json', { provider_message_id: messageId });
    for (const event of data || []) eventIds.add(event.id);
  }
  if (eventIds.size) {
    await admin.from('admin_tasks').delete().in('source_event_id', [...eventIds]);
  }
  await admin
    .from('admin_tasks')
    .delete()
    .eq('task_type', 'inbound_reply')
    .eq('entity_type', 'email_contact')
    .eq('entity_id', identifiers.email);
  if (identifiers.messageIds.length) {
    await admin
      .from('command_center_reply_memory')
      .delete()
      .in('message_id', identifiers.messageIds);
  }
  if (eventIds.size) {
    await admin.from('command_center_events').delete().in('id', [...eventIds]);
  }
  if (identifiers.suppressionIds.length) {
    await admin.from('lead_suppressions').delete().in('id', identifiers.suppressionIds);
  }
  if (identifiers.enrollmentIds.length) {
    await admin
      .from('command_center_outbound_enrollments')
      .delete()
      .in('id', identifiers.enrollmentIds);
  }
  if (identifiers.leadId) {
    await admin.from('leads').delete().eq('id', identifiers.leadId);
  }
  // Exact tagged fallback cleanup for a partially completed test.
  await admin.from('lead_suppressions').delete().eq('email', identifiers.email);
}

async function testLiveDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Live DB test requires Supabase URL and service-role credentials.');
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const tag = `codex-email-loop-${Date.now()}`;
  const email = `${tag}@example.invalid`;
  const positiveMessageId = `${tag}-positive`;
  const unmatchedMessageId = `${tag}-unmatched`;
  const ambiguousMessageId = `${tag}-ambiguous`;
  const unsubscribeMessageId = `${tag}-unsubscribe`;
  const outboundMessageId = `${tag}-outbound`;
  const identifiers = {
    email,
    messageIds: [
      positiveMessageId,
      unmatchedMessageId,
      ambiguousMessageId,
      unsubscribeMessageId,
    ],
    eventIds: [] as string[],
    suppressionIds: [] as string[],
    enrollmentIds: [] as string[],
    leadId: undefined as string | undefined,
  };

  try {
    const { data: lead, error: leadError } = await admin
      .from('leads')
      .insert({
        lead_type: 'business_funding',
        status: 'new',
        contact_info: { email },
        form_data: { controlled_test: true, tag },
        name: 'Controlled Test',
        email,
        source: 'codex_controlled_test',
        campaign_name: 'controlled-email-loop',
        property_address: '100 Test Loop',
        metadata_json: { controlled_test: true, tag },
        website_audit_json: {},
        automation_flags_json: {},
        bounce_risk_score: 0,
        delivery_status: 'not_sent',
      })
      .select('id')
      .single();
    if (leadError) throw leadError;
    identifiers.leadId = lead.id;

    const { data: enrollment, error: enrollmentError } = await admin
      .from('command_center_outbound_enrollments')
      .insert({
        lead_id: lead.id,
        strategy_key: 'controlled-email-loop',
        channel: 'email',
        recipient: email,
        property_address: '100 Test Loop',
        status: 'accepted',
        last_message_id: outboundMessageId,
        metadata_json: { controlled_test: true, tag },
      })
      .select('id')
      .single();
    if (enrollmentError) throw enrollmentError;
    identifiers.enrollmentIds.push(enrollment.id);

    const positive = await processInboundReply(admin, {
      provider: 'resend',
      providerEventId: `${tag}-event-positive`,
      providerMessageId: positiveMessageId,
      mailbox: 'acquisitions@vestblock.io',
      fromEmail: email,
      toEmail: 'acquisitions@vestblock.io',
      subject: 'Re: property details',
      text: "I'm interested. Can you send me more information?",
      receivedAt: new Date().toISOString(),
      threadId: `${tag}-thread`,
      correlationIds: [`<${outboundMessageId}>`],
    });
    assert.equal(positive.classification, 'positive_interested');
    assert.equal(positive.sequenceAction, 'pause');
    assert.equal(positive.leadId, lead.id);
    assert.ok(positive.replyMemoryId);
    assert.ok(positive.commandCenterEventId);
    assert.ok(positive.taskId);
    assert.ok(positive.suggestedReply);
    assert.equal(positive.outboundCorrelated, true);
    identifiers.eventIds.push(positive.commandCenterEventId!);

    const { data: positiveMemory } = await admin
      .from('command_center_reply_memory')
      .select('classification,metadata_json')
      .eq('id', positive.replyMemoryId!)
      .single();
    assert.equal(positiveMemory?.classification, 'hot_seller_lead');
    assert.equal(positiveMemory?.metadata_json?.reply_classification, 'positive_interested');

    const { data: paused } = await admin
      .from('command_center_outbound_enrollments')
      .select('status,next_action_at')
      .eq('id', enrollment.id)
      .single();
    assert.equal(paused?.status, 'replied');
    assert.equal(paused?.next_action_at, null);

    const { data: updatedLead } = await admin
      .from('leads')
      .select('status,outreach_status')
      .eq('id', lead.id)
      .single();
    assert.equal(updatedLead?.status, 'contacted');
    assert.equal(updatedLead?.outreach_status, 'not_started');

    const duplicate = await processInboundReply(admin, {
      provider: 'resend',
      providerEventId: `${tag}-event-positive-retry`,
      providerMessageId: positiveMessageId,
      mailbox: 'acquisitions@vestblock.io',
      fromEmail: email,
      text: "I'm interested. Can you send me more information?",
      correlationIds: [outboundMessageId],
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.replyMemoryId, positive.replyMemoryId);

    const unmatchedStop = await processInboundReply(admin, {
      provider: 'resend',
      providerEventId: `${tag}-event-unmatched`,
      providerMessageId: unmatchedMessageId,
      mailbox: 'acquisitions@vestblock.io',
      fromEmail: email,
      text: 'STOP. Please unsubscribe me and do not email me again.',
      correlationIds: [`${tag}-not-an-outbound-message`],
    });
    assert.equal(unmatchedStop.outboundCorrelated, false);
    assert.equal(unmatchedStop.classification, 'needs_human_review');
    assert.equal(unmatchedStop.leadId, null);
    assert.equal(unmatchedStop.enrollmentId, null);
    assert.equal(unmatchedStop.suppressionId, null);
    assert.ok(unmatchedStop.commandCenterEventId);
    assert.ok(unmatchedStop.taskId);
    identifiers.eventIds.push(unmatchedStop.commandCenterEventId!);

    const { data: stillUnsuppressed } = await admin
      .from('lead_suppressions')
      .select('id')
      .eq('email', email);
    assert.equal(stillUnsuppressed?.length || 0, 0);

    const { data: ambiguousEnrollment, error: ambiguousEnrollmentError } = await admin
      .from('command_center_outbound_enrollments')
      .insert({
        lead_id: lead.id,
        strategy_key: 'controlled-email-loop-ambiguous',
        channel: 'email',
        recipient: email,
        status: 'accepted',
        last_message_id: outboundMessageId,
        metadata_json: { controlled_test: true, tag, ambiguity_fixture: true },
      })
      .select('id')
      .single();
    if (ambiguousEnrollmentError) throw ambiguousEnrollmentError;
    identifiers.enrollmentIds.push(ambiguousEnrollment.id);

    const ambiguousReply = await processInboundReply(admin, {
      provider: 'resend',
      providerEventId: `${tag}-event-ambiguous`,
      providerMessageId: ambiguousMessageId,
      mailbox: 'acquisitions@vestblock.io',
      fromEmail: email,
      text: 'STOP. Please unsubscribe me.',
      correlationIds: [outboundMessageId],
    });
    assert.equal(ambiguousReply.outboundCorrelated, false);
    assert.equal(ambiguousReply.classification, 'needs_human_review');
    assert.equal(ambiguousReply.leadId, null);
    assert.equal(ambiguousReply.enrollmentId, null);
    assert.equal(ambiguousReply.suppressionId, null);
    identifiers.eventIds.push(ambiguousReply.commandCenterEventId!);

    const { data: ambiguityStates } = await admin
      .from('command_center_outbound_enrollments')
      .select('id,status')
      .in('id', [enrollment.id, ambiguousEnrollment.id]);
    assert.deepEqual(
      new Map((ambiguityStates || []).map((row) => [row.id, row.status])),
      new Map([
        [enrollment.id, 'replied'],
        [ambiguousEnrollment.id, 'accepted'],
      ])
    );

    const { error: removeAmbiguityError } = await admin
      .from('command_center_outbound_enrollments')
      .delete()
      .eq('id', ambiguousEnrollment.id);
    if (removeAmbiguityError) throw removeAmbiguityError;

    const unsubscribe = await processInboundReply(admin, {
      provider: 'resend',
      providerEventId: `${tag}-event-unsubscribe`,
      providerMessageId: unsubscribeMessageId,
      mailbox: 'acquisitions@vestblock.io',
      fromEmail: email,
      text: 'STOP. Please unsubscribe me and do not email me again.',
      correlationIds: [outboundMessageId],
    });
    assert.equal(unsubscribe.classification, 'unsubscribe');
    assert.equal(unsubscribe.sequenceAction, 'stop');
    assert.ok(unsubscribe.suppressionId);
    identifiers.eventIds.push(unsubscribe.commandCenterEventId!);
    identifiers.suppressionIds.push(unsubscribe.suppressionId!);

    const { data: stopped } = await admin
      .from('command_center_outbound_enrollments')
      .select('status,suppression_reason,next_action_at')
      .eq('id', enrollment.id)
      .single();
    assert.equal(stopped?.status, 'suppressed');
    assert.equal(stopped?.suppression_reason, 'unsubscribe');
    assert.equal(stopped?.next_action_at, null);

    const { data: suppressedLead } = await admin
      .from('leads')
      .select('status,outreach_status,suppression_reason')
      .eq('id', lead.id)
      .single();
    assert.equal(suppressedLead?.status, 'do_not_contact');
    assert.equal(suppressedLead?.outreach_status, 'do_not_contact');
    assert.equal(suppressedLead?.suppression_reason, 'unsubscribe');

    const { data: suppression } = await admin
      .from('lead_suppressions')
      .select('status,reason')
      .eq('id', unsubscribe.suppressionId!)
      .single();
    assert.equal(suppression?.status, 'active');
    assert.equal(suppression?.reason, 'unsubscribe_reply');

    console.log('PASS live DB: match -> classify -> pause/stop -> task/event -> suppression');
  } finally {
    await cleanupLiveTest(admin, identifiers);
    console.log('PASS cleanup: controlled DB records removed');
  }
}

async function main() {
  testClassifications();
  testCorrelationPolicy();
  if (process.argv.includes('--live-db')) await testLiveDatabase();
  else console.log('SKIP live DB (pass --live-db to run the tagged write/cleanup test)');
}

main().catch((error) => {
  console.error('FAIL email operations test:', error instanceof Error ? error.message : error);
  process.exit(1);
});
