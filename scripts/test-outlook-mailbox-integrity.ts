import assert from 'node:assert/strict'

import {
  correlateOutlookInbound,
  evaluateOutlookInboundIntegrity,
  selectCorrelatedLead,
  shouldProcessMailboxSideEffects,
} from '../lib/email/outlookMailboxIntegrity'

const inboundAt = '2026-09-10T14:00:00.000Z'
const outboundAt = '2026-09-09T14:00:00.000Z'

const newsletterMessage = {
  id: 'newsletter-1',
  receivedDateTime: inboundAt,
  subject: '10,000 AI agents: builders are actively buying',
  bodyPreview:
    'This week: acquisition criteria, proof of funds, and developer news. Manage preferences or unsubscribe.',
  from: { emailAddress: { address: 'newsletter@example.com', name: 'Example Weekly' } },
  internetMessageHeaders: [
    { name: 'List-Id', value: '<weekly.example.com>' },
    { name: 'List-Unsubscribe', value: '<https://example.com/unsubscribe>' },
    { name: 'Precedence', value: 'bulk' },
  ],
}

const newsletter = evaluateOutlookInboundIntegrity({
  message: newsletterMessage,
  correlation: correlateOutlookInbound(newsletterMessage, 'newsletter@example.com', []),
  relationships: { buyer: true },
})

assert.equal(newsletter.classification, 'low_priority')
assert.equal(newsletter.explicitOptOut, false, 'a newsletter footer is not a recipient opt-out request')
assert.equal(newsletter.actionableReply, false)
assert.equal(newsletter.allowRelationshipMutation, false)
assert.equal(newsletter.allowBuyerCreation, false)
assert.equal(newsletter.allowSuppression, false)

const contactedNewsletter = evaluateOutlookInboundIntegrity({
  message: newsletterMessage,
  correlation: correlateOutlookInbound(newsletterMessage, 'newsletter@example.com', [
    {
      source: 'enrollment',
      leadId: null,
      strategyKey: 'buyer-network',
      recipient: 'newsletter@example.com',
      outboundMessageId: 'outbound-newsletter',
      occurredAt: outboundAt,
      metadata: {},
    },
  ]),
  relationships: { buyer: true },
})
assert.equal(contactedNewsletter.classification, 'low_priority', 'bulk mail never becomes a reply')
assert.equal(contactedNewsletter.actionableReply, false)

const senderFooterMessage = {
  id: 'sender-footer-1',
  receivedDateTime: inboundAt,
  subject: 'A quick partnership idea',
  bodyPreview:
    'I wanted to share an offer. If you do not want to receive my messages, please reply with "opt-out".',
  from: { emailAddress: { address: 'promoter@example.com', name: 'Promoter' } },
}
const senderFooter = evaluateOutlookInboundIntegrity({
  message: senderFooterMessage,
  correlation: correlateOutlookInbound(senderFooterMessage, 'promoter@example.com', [
    {
      source: 'send_event',
      leadId: 'lead-promoter',
      strategyKey: 'buyer-network',
      recipient: 'promoter@example.com',
      outboundMessageId: 'promoter-send',
      occurredAt: outboundAt,
      metadata: {},
    },
  ]),
  relationships: { buyer: true },
})
assert.equal(senderFooter.bulkMail, true)
assert.equal(senderFooter.explicitOptOut, false)
assert.equal(senderFooter.actionableReply, false)
assert.equal(senderFooter.allowSuppression, false)

const correlatedReplyMessage = {
  id: 'reply-1',
  receivedDateTime: inboundAt,
  subject: 'Re: Cleveland acquisition criteria',
  bodyPreview: 'Yes, we are actively buying. Send the property address and asking price.',
  from: { emailAddress: { address: 'buyer@example.com', name: 'Casey Buyer' } },
}
const correlatedReply = evaluateOutlookInboundIntegrity({
  message: correlatedReplyMessage,
  correlation: correlateOutlookInbound(correlatedReplyMessage, 'buyer@example.com', [
    {
      source: 'enrollment',
      leadId: null,
      strategyKey: 'buyer-network',
      recipient: 'buyer@example.com',
      outboundMessageId: 'outbound-1',
      occurredAt: outboundAt,
      metadata: {},
    },
  ]),
  relationships: { buyer: true },
})

assert.equal(correlatedReply.classification, 'partner_reply')
assert.equal(correlatedReply.explicitOptOut, false)
assert.equal(correlatedReply.actionableReply, true)
assert.equal(correlatedReply.allowRelationshipMutation, true)
assert.equal(correlatedReply.allowBuyerCreation, false, 'an existing buyer must not be duplicated')
assert.equal(correlatedReply.allowSuppression, false)

const uncorrelatedOptOutMessage = {
  id: 'opt-out-uncorrelated',
  receivedDateTime: inboundAt,
  subject: 'Remove me',
  bodyPreview: 'Please remove me from your list.',
  from: { emailAddress: { address: 'unknown@example.com', name: 'Unknown Sender' } },
}
const uncorrelatedOptOut = evaluateOutlookInboundIntegrity({
  message: uncorrelatedOptOutMessage,
  correlation: correlateOutlookInbound(uncorrelatedOptOutMessage, 'unknown@example.com', []),
  relationships: {},
})
assert.equal(uncorrelatedOptOut.explicitOptOut, true)
assert.equal(uncorrelatedOptOut.allowSuppression, false, 'uncorrelated mail cannot suppress an address')

const correlatedOptOutMessage = {
  id: 'opt-out-1',
  receivedDateTime: inboundAt,
  subject: 'Re: 4821 Cedar Ave',
  bodyPreview: 'No thank you. Please remove me from your list and do not contact me again.',
  from: { emailAddress: { address: 'owner@example.com', name: 'Property Owner' } },
  internetMessageHeaders: [{ name: 'In-Reply-To', value: '<resend-message-1@resend.dev>' }],
}
const correlatedOptOut = evaluateOutlookInboundIntegrity({
  message: correlatedOptOutMessage,
  correlation: correlateOutlookInbound(correlatedOptOutMessage, 'forwarded@example.com', [
    {
      source: 'send_event',
      leadId: 'lead-1',
      strategyKey: null,
      recipient: 'owner@example.com',
      outboundMessageId: 'outbound-2',
      occurredAt: outboundAt,
      metadata: { providerMessageId: 'resend-message-1' },
    },
  ]),
  relationships: { lead: true },
})

assert.equal(correlatedOptOut.classification, 'low_priority')
assert.equal(correlatedOptOut.explicitOptOut, true)
assert.equal(correlatedOptOut.actionableReply, false)
assert.equal(correlatedOptOut.allowRelationshipMutation, false)
assert.equal(correlatedOptOut.allowBuyerCreation, false)
assert.equal(correlatedOptOut.allowSuppression, true)

for (const bodyPreview of [
  'Please take me off your list.',
  'Do not email me again.',
  'Not interested, please stop.',
  'Remove me.',
  'Please opt me out.',
  'Opt out.',
  'No thanks, remove me.',
  'Please do not send me any more emails.',
]) {
  const message = {
    id: `common-opt-out-${bodyPreview}`,
    receivedDateTime: inboundAt,
    subject: 'Re: funding criteria',
    bodyPreview,
    from: { emailAddress: { address: 'contacted@example.com', name: 'Contacted Person' } },
  }
  const result = evaluateOutlookInboundIntegrity({
    message,
    correlation: correlateOutlookInbound(message, 'contacted@example.com', [
      {
        source: 'enrollment',
        leadId: 'lead-common-opt-out',
        strategyKey: 'lender-network',
        recipient: 'contacted@example.com',
        outboundMessageId: 'outbound-common-opt-out',
        occurredAt: outboundAt,
        metadata: {},
      },
    ]),
    relationships: { lender: true },
  })
  assert.equal(result.classification, 'low_priority')
  assert.equal(result.explicitOptOut, true, `missed opt-out language: ${bodyPreview}`)
  assert.equal(result.actionableReply, false)
  assert.equal(result.allowSuppression, true)
}

const laterSend = correlateOutlookInbound(correlatedReplyMessage, 'buyer@example.com', [
  {
    source: 'send_event',
    leadId: 'lead-later',
    strategyKey: 'buyer-network',
    recipient: 'buyer@example.com',
    outboundMessageId: 'later-send',
    occurredAt: '2026-09-11T14:00:00.000Z',
    metadata: {},
  },
])
assert.equal(laterSend.matched, false, 'an outbound send after the inbound cannot validate it')

const staleSend = correlateOutlookInbound(correlatedReplyMessage, 'buyer@example.com', [
  {
    source: 'send_event',
    leadId: 'lead-stale',
    strategyKey: 'buyer-network',
    recipient: 'buyer@example.com',
    outboundMessageId: 'stale-send',
    occurredAt: '2026-04-01T14:00:00.000Z',
    metadata: {},
  },
])
assert.equal(staleSend.matched, false, 'recipient fallback must stay inside the bounded reply window')

const insideRecipientWindow = correlateOutlookInbound(correlatedReplyMessage, 'buyer@example.com', [
  {
    source: 'send_event',
    leadId: 'lead-inside-window',
    strategyKey: 'buyer-network',
    recipient: 'buyer@example.com',
    outboundMessageId: 'inside-window-send',
    occurredAt: '2026-08-28T14:00:00.000Z',
    metadata: {},
  },
])
assert.equal(insideRecipientWindow.matched, true, 'recipient fallback should accept a send 13 days earlier')

const outsideRecipientWindow = correlateOutlookInbound(correlatedReplyMessage, 'buyer@example.com', [
  {
    source: 'send_event',
    leadId: 'lead-outside-window',
    strategyKey: 'buyer-network',
    recipient: 'buyer@example.com',
    outboundMessageId: 'outside-window-send',
    occurredAt: '2026-08-26T14:00:00.000Z',
    metadata: {},
  },
])
assert.equal(outsideRecipientWindow.matched, false, 'recipient fallback must reject a send 15 days earlier')

const correlationIdMessage = {
  ...correlatedReplyMessage,
  id: 'correlation-id-reply',
  internetMessageHeaders: [{ name: 'X-VestBlock-Correlation-Id', value: 'corr-exact-1' }],
}
const exactCorrelation = correlateOutlookInbound(correlationIdMessage, 'alias@example.com', [
  {
    source: 'send_event',
    leadId: 'lead-exact',
    strategyKey: 'seller-targeted',
    recipient: 'buyer@example.com',
    outboundMessageId: 'exact-send',
    occurredAt: '2026-08-01T14:00:00.000Z',
    metadata: { correlationId: 'corr-exact-1' },
  },
])
assert.equal(exactCorrelation.matched, true)
assert.equal(exactCorrelation.matchType, 'correlation_id')
assert.equal(exactCorrelation.leadId, 'lead-exact')

const duplicateLeads = [
  { id: 'lead-wrong', email: 'shared@example.com' },
  { id: 'lead-right', email: 'shared@example.com' },
]
assert.equal(
  selectCorrelatedLead({
    leads: duplicateLeads,
    fromEmail: 'shared@example.com',
    correlation: { matched: true, leadId: 'lead-right' },
  })?.id,
  'lead-right'
)
assert.equal(
  selectCorrelatedLead({
    leads: duplicateLeads,
    fromEmail: 'shared@example.com',
    correlation: { matched: true },
  }),
  null,
  'duplicate email rows must not collapse to an arbitrary lead'
)

assert.equal(
  shouldProcessMailboxSideEffects({
    metadata: {},
    actionableReply: true,
    allowSuppression: false,
  }),
  true,
  'a persisted reply without a completion marker must retry side effects'
)
assert.equal(
  shouldProcessMailboxSideEffects({
    metadata: { mailboxSideEffects: { status: 'completed' } },
    actionableReply: true,
    allowSuppression: false,
  }),
  false,
  'completed side effects must remain idempotent'
)

console.log('outlook-mailbox-integrity: ok')
