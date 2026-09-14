import assert from 'node:assert/strict'

import { buildMailboxFalsePositiveRepairPlan } from './lib/mailbox-false-positive-repair.mjs'

const falseReply = {
  id: 'reply-false',
  message_id: 'message-false',
  thread_id: null,
  from_email: 'newsletter@example.com',
  subject: 'AI Automation Builders is open',
  reply_summary: 'This week in builder automation. Manage email preferences or unsubscribe.',
  classification: 'partner_reply',
  received_at: '2026-09-10T14:00:00.000Z',
  metadata_json: { explicitOptOut: true },
}

const baseInput = {
  replyRows: [
    falseReply,
    {
      id: 'reply-real',
      message_id: 'message-real',
      thread_id: null,
      from_email: 'buyer@example.com',
      subject: 'Re: acquisition criteria',
      reply_summary: 'We are actively buying. Please send the address.',
      classification: 'partner_reply',
      received_at: '2026-09-10T14:00:00.000Z',
      metadata_json: {},
    },
    {
      id: 'unsolicited-seller',
      message_id: 'message-seller',
      thread_id: null,
      from_email: 'owner@example.com',
      subject: 'My property',
      reply_summary: 'I may sell my property at 4821 Cedar Ave.',
      classification: 'hot_seller_lead',
      received_at: '2026-09-10T14:00:00.000Z',
      metadata_json: {},
    },
    {
      id: 'real-opt-out',
      message_id: 'message-opt-out',
      thread_id: null,
      from_email: 'contacted@example.com',
      subject: 'Re: quick question',
      reply_summary: 'Please remove me from your list and do not contact me again.',
      classification: 'low_priority',
      received_at: '2026-09-10T14:00:00.000Z',
      metadata_json: { explicitOptOut: true },
    },
  ],
  outboundRows: [
    { recipient: 'buyer@example.com', status: 'delivered', created_at: '2026-09-09T14:00:00.000Z' },
    { recipient: 'contacted@example.com', status: 'accepted', created_at: '2026-09-09T14:00:00.000Z' },
    { recipient: 'newsletter@example.com', status: 'delivered', created_at: '2026-09-11T14:00:00.000Z' },
    { recipient: 'newsletter@example.com', status: 'delivered', created_at: '2026-04-01T14:00:00.000Z' },
    { recipient: 'failed@example.com', status: 'failed', created_at: '2026-09-09T14:00:00.000Z' },
  ],
  tasks: [
    {
      id: 'task-false',
      task_type: 'lender_reply_criteria_capture',
      status: 'open',
      metadata_json: { messageId: 'message-false' },
    },
    {
      id: 'task-unrelated',
      task_type: 'buyer_reply_buy_box_capture',
      status: 'open',
      metadata_json: { messageId: 'message-real' },
    },
  ],
  suppressions: [
    {
      id: 'suppression-false',
      email: 'newsletter@example.com',
      status: 'active',
      reason: 'Explicit email opt-out received in Outlook.',
    },
    {
      id: 'suppression-real',
      email: 'contacted@example.com',
      status: 'active',
      reason: 'Explicit email opt-out received in Outlook.',
    },
  ],
  buyers: [
    {
      id: 'buyer-false',
      contact_email: 'newsletter@example.com',
      source: 'outlook_partner_reply',
      relationship_stage: 'responded',
      outreach_status: 'responded',
    },
    {
      id: 'buyer-real',
      contact_email: 'buyer@example.com',
      source: 'outlook_partner_reply',
      relationship_stage: 'responded',
      outreach_status: 'responded',
    },
  ],
}

const plan = buildMailboxFalsePositiveRepairPlan(baseInput)

assert.deepEqual(plan.counts, {
  repliesToReclassify: 1,
  tasksToDismiss: 1,
  suppressionsToRelease: 1,
  buyersToQuarantine: 1,
})
assert.deepEqual(plan.replyUpdates.map((row) => row.id), ['reply-false'])
assert.deepEqual(plan.taskIds, ['task-false'])
assert.deepEqual(plan.suppressionIds, ['suppression-false'])
assert.deepEqual(plan.buyerIds, ['buyer-false'])
assert.deepEqual(plan.suppressionEmails, ['newsletter@example.com'])
assert.deepEqual(plan.footerUpdates.map((row) => row.id), ['reply-false'])

const senderFooterPlan = buildMailboxFalsePositiveRepairPlan({
  replyRows: [
    {
      id: 'reply-sender-footer',
      message_id: 'message-sender-footer',
      from_email: 'promoter@example.com',
      subject: 'A quick partnership idea',
      reply_summary:
        'If you do not want to receive my messages, please reply with "opt-out" or "unsubscribe".',
      classification: 'low_priority',
      received_at: '2026-09-10T14:00:00.000Z',
      metadata_json: { explicitOptOut: true },
    },
  ],
  outboundRows: [],
  tasks: [],
  suppressions: [
    {
      id: 'suppression-sender-footer',
      email: 'promoter@example.com',
      status: 'active',
      reason: 'Explicit email opt-out received in Outlook.',
    },
  ],
  buyers: [],
})
assert.equal(senderFooterPlan.counts.suppressionsToRelease, 1)
assert.deepEqual(senderFooterPlan.footerUpdates.map((row) => row.id), ['reply-sender-footer'])

const repairedReply = {
  ...falseReply,
  classification: 'low_priority',
  metadata_json: {
    ...falseReply.metadata_json,
    correlatedOutbound: false,
    actionableReply: false,
    integrityRepair: { reason: 'uncorrelated_campaign_like_inbound' },
  },
}
const partialRetryPlan = buildMailboxFalsePositiveRepairPlan({
  ...baseInput,
  replyRows: [repairedReply],
})
assert.deepEqual(partialRetryPlan.counts, {
  repliesToReclassify: 0,
  tasksToDismiss: 1,
  suppressionsToRelease: 1,
  buyersToQuarantine: 1,
})
assert.deepEqual(partialRetryPlan.footerUpdates.map((row) => row.id), ['reply-false'])

const postReleaseCrashPlan = buildMailboxFalsePositiveRepairPlan({
  ...baseInput,
  replyRows: [
    {
      ...repairedReply,
      metadata_json: {
        ...repairedReply.metadata_json,
        explicitOptOut: false,
        integrityRepair: {
          ...repairedReply.metadata_json.integrityRepair,
          outlookFooterFalseOptOut: true,
        },
      },
    },
  ],
  tasks: [{ ...baseInput.tasks[0], status: 'dismissed' }],
  suppressions: [{ ...baseInput.suppressions[0], status: 'released' }],
  buyers: [
    {
      ...baseInput.buyers[0],
      relationship_stage: 'not_a_fit',
      outreach_status: 'do_not_contact',
    },
  ],
})
assert.deepEqual(postReleaseCrashPlan.counts, {
  repliesToReclassify: 0,
  tasksToDismiss: 0,
  suppressionsToRelease: 0,
  buyersToQuarantine: 0,
})
assert.deepEqual(postReleaseCrashPlan.footerUpdates, [])
assert.deepEqual(
  postReleaseCrashPlan.suppressionEmails,
  ['newsletter@example.com'],
  'durable footer evidence must retain the exact lead-flag repair cohort after suppression release'
)

const legitimateCollisionPlan = buildMailboxFalsePositiveRepairPlan({
  replyRows: [
    {
      id: 'false-footer-before-send',
      message_id: 'false-footer-before-send-message',
      from_email: 'collision@example.com',
      subject: 'A product update',
      reply_summary: 'Manage email preferences or unsubscribe.',
      classification: 'low_priority',
      received_at: '2026-09-08T14:00:00.000Z',
      metadata_json: { explicitOptOut: true },
    },
    {
      id: 'legitimate-direct-opt-out',
      message_id: 'legitimate-direct-opt-out-message',
      from_email: 'collision@example.com',
      subject: 'Re: quick question',
      reply_summary: 'Remove me.',
      classification: 'low_priority',
      received_at: '2026-09-10T14:00:00.000Z',
      metadata_json: { explicitOptOut: true },
    },
  ],
  outboundRows: [
    {
      recipient: 'collision@example.com',
      status: 'delivered',
      outreach_message_id: 'real-outbound-message',
      created_at: '2026-09-09T14:00:00.000Z',
    },
  ],
  tasks: [],
  suppressions: [
    {
      id: 'collision-suppression',
      email: 'collision@example.com',
      status: 'active',
      reason: 'Explicit email opt-out received in Outlook.',
    },
  ],
  buyers: [],
})
assert.equal(
  legitimateCollisionPlan.counts.suppressionsToRelease,
  0,
  'a separate correlated direct opt-out must preserve the suppression'
)
assert.deepEqual(legitimateCollisionPlan.suppressionEmails, [])

console.log('mailbox-false-positive-repair: ok')
