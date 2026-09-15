import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  correlateOutlookInbound,
  evaluateOutlookInboundIntegrity,
  evaluateOutlookSenderAuthentication,
  requireOutlookThroughputProjectionUpdated,
  selectCorrelatedLead,
  shouldProcessMailboxSideEffects,
} from '../lib/email/outlookMailboxIntegrity'
import {
  buildOutlookMailboxInitialUrl,
  validateOutlookMailboxContinuationUrl,
} from '../lib/email/outlookMailboxPaginationCore'

const mailbox = 'acquisitions@vestblock.io'
const initialMailboxUrl = buildOutlookMailboxInitialUrl({
  mailbox,
  since: '2026-09-15T00:00:00.000Z',
  pageSize: 100,
})
assert.equal(new URL(initialMailboxUrl).searchParams.get('$top'), '50')
assert.equal(validateOutlookMailboxContinuationUrl(initialMailboxUrl, mailbox), initialMailboxUrl)
assert.equal(
  validateOutlookMailboxContinuationUrl(
    'https://graph.microsoft.com/v1.0/users/acquisitions%40vestblock.io/mailFolders/inbox/messages?%24skiptoken=opaque',
    mailbox
  ),
  'https://graph.microsoft.com/v1.0/users/acquisitions%40vestblock.io/mailFolders/inbox/messages?%24skiptoken=opaque'
)
for (const unsafeUrl of [
  'https://graph.microsoft.com.evil.example/v1.0/users/acquisitions%40vestblock.io/mailFolders/inbox/messages',
  'http://graph.microsoft.com/v1.0/users/acquisitions%40vestblock.io/mailFolders/inbox/messages',
  'https://graph.microsoft.com/v1.0/users/other%40example.com/mailFolders/inbox/messages',
  'https://graph.microsoft.com/v1.0/users/acquisitions%40vestblock.io/messages',
]) {
  assert.equal(validateOutlookMailboxContinuationUrl(unsafeUrl, mailbox), null)
}

const mailboxRuntime = readFileSync(resolve(process.cwd(), 'lib/email/outlookMailbox.ts'), 'utf8')
assert.match(mailboxRuntime, /claim_outlook_mailbox_side_effects/)
assert.match(mailboxRuntime, /claim_outlook_mailbox_sync/)
assert.match(mailboxRuntime, /finalize_outlook_mailbox_sync/)
assert.match(mailboxRuntime, /claimToken: syncClaimToken/)
assert.match(mailboxRuntime, /sideEffectClaimsDeferred/)
assert.match(mailboxRuntime, /baseMessages\.push\(\.\.\.pageMessages\)/)
assert.doesNotMatch(mailboxRuntime, /pageMessages\.slice\(/)
assert.match(mailboxRuntime, /outreach_send_events'[\s\S]*\.select\('[^']*provider[^']*'\)/)
assert.match(mailboxRuntime, /correlatedOutboundProvider: outboundCorrelation\.provider \|\| null/)
assert.match(mailboxRuntime, /provider: correlatedOutboundProvider\.trim\(\)\.toLowerCase\(\)/)
assert.match(mailboxRuntime, /requireOutlookThroughputProjectionUpdated\(result\)/)
assert.match(mailboxRuntime, /highWatermark/)
assert.match(mailboxRuntime, /windowStartedAt/)
assert.match(mailboxRuntime, /overlapMinutes = 15/)
assert.match(mailboxRuntime, /input\.metrics !== undefined/)
assert.match(mailboxRuntime, /highWatermark: ingestionPending \? cursorState\.highWatermark : windowStartedAt/)
assert.match(mailboxRuntime, /sideEffectClaimsDeferred > 0\s*\? runStartPageUrl\s*: continuationUrl/)
const mailboxMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260915141718_create_outreach_throughput_governor.sql'),
  'utf8'
)
assert.match(mailboxMigration, /CREATE OR REPLACE FUNCTION claim_outlook_mailbox_side_effects/)
assert.match(mailboxMigration, /CREATE OR REPLACE FUNCTION claim_outlook_mailbox_sync/)
assert.match(mailboxMigration, /CREATE OR REPLACE FUNCTION finalize_outlook_mailbox_sync/)
assert.match(mailboxMigration, /mailbox_sync_lease_not_owned/)
assert.match(mailboxMigration, /FOR UPDATE;/)
assert.match(mailboxMigration, /mailbox_side_effects_claim_active/)

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
  internetMessageHeaders: [
    {
      name: 'In-Reply-To',
      value: '<resend-recipient-1@resend.dev>',
    },
    {
      name: 'Authentication-Results',
      value: 'spf=pass smtp.mailfrom=mail.example.com; dkim=pass header.d=example.com; dmarc=pass action=none header.from=example.com',
    },
  ],
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
      metadata: { providerMessageId: 'resend-recipient-1' },
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
assert.equal(correlatedReply.senderAuthentication.aligned, true)
assert.equal(correlatedReply.senderAuthentication.method, 'dmarc')
assert.equal(correlatedReply.stateChangeAuthorized, true)
const recipientCorrelation = correlateOutlookInbound(
  { ...correlatedReplyMessage, internetMessageHeaders: [] },
  'buyer@example.com',
  [
    {
      source: 'enrollment',
      leadId: null,
      strategyKey: 'buyer-network',
      recipient: 'buyer@example.com',
      outboundMessageId: 'internal-recipient-1',
      occurredAt: outboundAt,
      metadata: { providerMessageId: 'resend-recipient-1' },
    },
  ]
)
assert.equal(recipientCorrelation.matchType, 'recipient')
assert.equal(recipientCorrelation.outboundMessageId, 'internal-recipient-1')
assert.equal(recipientCorrelation.providerMessageId, 'resend-recipient-1')

const gmailReplyMessage = {
  ...correlatedReplyMessage,
  id: 'gmail-reply-1',
  internetMessageHeaders: [{ name: 'In-Reply-To', value: '<gmail-provider-message-1@mail.gmail.com>' }],
}
const gmailReplyCorrelation = correlateOutlookInbound(
  gmailReplyMessage,
  'buyer@example.com',
  [
    {
      source: 'send_event',
      leadId: null,
      strategyKey: 'buyer-network',
      recipient: 'buyer@example.com',
      outboundMessageId: 'internal-gmail-message-1',
      provider: 'gmail',
      providerMessageId: 'gmail-provider-message-1',
      occurredAt: outboundAt,
      metadata: {},
    },
  ]
)
assert.equal(gmailReplyCorrelation.matchType, 'message_reference')
assert.equal(gmailReplyCorrelation.provider, 'gmail')
assert.equal(gmailReplyCorrelation.providerMessageId, 'gmail-provider-message-1')
assert.equal(
  evaluateOutlookInboundIntegrity({
    message: gmailReplyMessage,
    correlation: gmailReplyCorrelation,
    relationships: { buyer: true },
  }).actionableReply,
  true
)
assert.doesNotThrow(() => requireOutlookThroughputProjectionUpdated({ updated: true }))
assert.throws(
  () => requireOutlookThroughputProjectionUpdated({
    updated: false,
    reason: 'outreach_attempt_not_found',
  }),
  /outreach_attempt_not_found/,
  'a missing Gmail-keyed throughput reservation must leave mailbox side effects retryable'
)

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
const messageReferenceCorrelation = correlateOutlookInbound(
  correlatedOptOutMessage,
  'forwarded@example.com',
  [
    {
      source: 'send_event',
      leadId: 'lead-1',
      strategyKey: null,
      recipient: 'owner@example.com',
      outboundMessageId: 'internal-reference-1',
      occurredAt: outboundAt,
      metadata: { providerMessageId: 'resend-message-1' },
    },
  ]
)
assert.equal(messageReferenceCorrelation.matchType, 'message_reference')
assert.equal(messageReferenceCorrelation.outboundMessageId, 'internal-reference-1')
assert.equal(messageReferenceCorrelation.providerMessageId, 'resend-message-1')

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
    internetMessageHeaders: [
      {
        name: 'In-Reply-To',
        value: '<resend-common-opt-out@resend.dev>',
      },
      {
        name: 'Authentication-Results',
        value: 'spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com',
      },
    ],
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
        metadata: { providerMessageId: 'resend-common-opt-out' },
      },
    ]),
    relationships: { lender: true },
  })
  assert.equal(result.classification, 'low_priority')
  assert.equal(result.explicitOptOut, true, `missed opt-out language: ${bodyPreview}`)
  assert.equal(result.actionableReply, false)
  assert.equal(result.allowSuppression, true)
}

const spoofedFromMessage = {
  id: 'spoofed-recipient-fallback',
  receivedDateTime: inboundAt,
  subject: 'Remove me',
  bodyPreview: 'Please remove me from your list.',
  from: { emailAddress: { address: 'buyer@example.com', name: 'Spoofed Buyer' } },
  internetMessageHeaders: [
    {
      name: 'Authentication-Results',
      value: 'spf=fail smtp.mailfrom=evil.example; dkim=pass header.d=evil.example; dmarc=fail header.from=example.com',
    },
  ],
}
const spoofedFromCorrelation = correlateOutlookInbound(
  spoofedFromMessage,
  'buyer@example.com',
  [
    {
      source: 'send_event',
      leadId: 'lead-spoof-target',
      strategyKey: 'buyer-network',
      recipient: 'buyer@example.com',
      outboundMessageId: 'outbound-spoof-target',
      occurredAt: outboundAt,
      metadata: {},
    },
  ]
)
const spoofedFromIntegrity = evaluateOutlookInboundIntegrity({
  message: spoofedFromMessage,
  correlation: spoofedFromCorrelation,
  relationships: { buyer: true },
})
assert.equal(spoofedFromCorrelation.matchType, 'recipient')
assert.equal(spoofedFromIntegrity.senderAuthentication.aligned, false)
assert.equal(spoofedFromIntegrity.senderAuthentication.status, 'failed_or_unaligned')
assert.equal(spoofedFromIntegrity.stateChangeAuthorized, false)
assert.equal(spoofedFromIntegrity.manualReviewRequired, true)
assert.equal(spoofedFromIntegrity.classification, 'low_priority')
assert.equal(spoofedFromIntegrity.actionableReply, false)
assert.equal(spoofedFromIntegrity.allowRelationshipMutation, false)
assert.equal(spoofedFromIntegrity.allowSuppression, false)

const missingAuthenticationMessage = {
  ...spoofedFromMessage,
  id: 'missing-auth-recipient-fallback',
  internetMessageHeaders: [],
}
const missingAuthenticationIntegrity = evaluateOutlookInboundIntegrity({
  message: missingAuthenticationMessage,
  correlation: correlateOutlookInbound(
    missingAuthenticationMessage,
    'buyer@example.com',
    [
      {
        source: 'send_event',
        leadId: 'lead-missing-auth-target',
        strategyKey: 'buyer-network',
        recipient: 'buyer@example.com',
        outboundMessageId: 'outbound-missing-auth-target',
        occurredAt: outboundAt,
        metadata: {},
      },
    ]
  ),
  relationships: { buyer: true },
})
assert.equal(missingAuthenticationIntegrity.senderAuthentication.status, 'missing')
assert.equal(missingAuthenticationIntegrity.manualReviewRequired, true)
assert.equal(missingAuthenticationIntegrity.actionableReply, false)
assert.equal(missingAuthenticationIntegrity.allowSuppression, false)

assert.equal(
  evaluateOutlookSenderAuthentication(
    {
      ...spoofedFromMessage,
      internetMessageHeaders: [
        {
          name: 'Authentication-Results',
          value: 'spf=pass smtp.mailfrom=evil.example; dkim=pass header.d=evil.example; dmarc=pass header.from=evil.example',
        },
      ],
    },
    'buyer@example.com'
  ).aligned,
  false,
  'passing authentication for an unrelated domain must not authenticate the visible From address'
)

const injectedArcAuthenticationMessage = {
  ...spoofedFromMessage,
  id: 'injected-aar-recipient-fallback',
  subject: 'Interested',
  bodyPreview: 'Yes, please send more details.',
  internetMessageHeaders: [
    {
      name: 'ARC-Authentication-Results',
      value: 'spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com',
    },
  ],
}
const injectedArcAuthenticationIntegrity = evaluateOutlookInboundIntegrity({
  message: injectedArcAuthenticationMessage,
  correlation: correlateOutlookInbound(
    injectedArcAuthenticationMessage,
    'buyer@example.com',
    [
      {
        source: 'send_event',
        leadId: 'lead-injected-aar-target',
        strategyKey: 'buyer-network',
        recipient: 'buyer@example.com',
        outboundMessageId: 'outbound-injected-aar-target',
        occurredAt: outboundAt,
        metadata: {},
      },
    ]
  ),
  relationships: { buyer: true },
})
assert.equal(injectedArcAuthenticationIntegrity.senderAuthentication.aligned, false)
assert.equal(injectedArcAuthenticationIntegrity.senderAuthentication.status, 'missing')
assert.equal(injectedArcAuthenticationIntegrity.manualReviewRequired, true)
assert.equal(injectedArcAuthenticationIntegrity.stateChangeAuthorized, false)
assert.equal(injectedArcAuthenticationIntegrity.allowRelationshipMutation, false)
assert.equal(injectedArcAuthenticationIntegrity.allowSuppression, false)

const injectedStandardAuthenticationMessage = {
  ...injectedArcAuthenticationMessage,
  id: 'injected-standard-ar-recipient-fallback',
  internetMessageHeaders: [
    {
      name: 'Authentication-Results',
      value: 'spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com',
    },
  ],
}
const injectedStandardAuthenticationIntegrity = evaluateOutlookInboundIntegrity({
  message: injectedStandardAuthenticationMessage,
  correlation: correlateOutlookInbound(
    injectedStandardAuthenticationMessage,
    'buyer@example.com',
    [
      {
        source: 'send_event',
        leadId: 'lead-injected-standard-ar-target',
        strategyKey: 'buyer-network',
        recipient: 'buyer@example.com',
        outboundMessageId: 'outbound-injected-standard-ar-target',
        occurredAt: outboundAt,
        metadata: {},
      },
    ]
  ),
  relationships: { buyer: true },
})
assert.equal(injectedStandardAuthenticationIntegrity.senderAuthentication.aligned, true)
assert.equal(injectedStandardAuthenticationIntegrity.manualReviewRequired, true)
assert.equal(injectedStandardAuthenticationIntegrity.stateChangeAuthorized, false)
assert.equal(injectedStandardAuthenticationIntegrity.actionableReply, false)
assert.equal(injectedStandardAuthenticationIntegrity.allowRelationshipMutation, false)
assert.equal(injectedStandardAuthenticationIntegrity.allowSuppression, false)

const exactFailedDmarcMessage = {
  ...spoofedFromMessage,
  id: 'exact-reference-failed-dmarc',
  internetMessageHeaders: [
    { name: 'In-Reply-To', value: '<resend-exact-reference@resend.dev>' },
    { name: 'Authentication-Results', value: 'spf=fail; dkim=fail; dmarc=fail header.from=example.com' },
  ],
}
const exactFailedDmarcIntegrity = evaluateOutlookInboundIntegrity({
  message: exactFailedDmarcMessage,
  correlation: correlateOutlookInbound(exactFailedDmarcMessage, 'buyer@example.com', [
    {
      source: 'send_event',
      leadId: 'lead-exact-reference',
      strategyKey: 'buyer-network',
      recipient: 'buyer@example.com',
      outboundMessageId: 'internal-exact-reference',
      providerMessageId: 'resend-exact-reference',
      occurredAt: outboundAt,
      metadata: {},
    },
  ]),
  relationships: { buyer: true },
})
assert.equal(exactFailedDmarcIntegrity.exactCorrelation, true)
assert.equal(exactFailedDmarcIntegrity.stateChangeAuthorized, true)
assert.equal(exactFailedDmarcIntegrity.actionableReply, false, 'the explicit opt-out remains a suppression, not a positive reply')
assert.equal(exactFailedDmarcIntegrity.allowSuppression, true)

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
    metadata: { correlationId: 'corr-exact-1', providerMessageId: 'resend-correlation-1' },
  },
])
assert.equal(exactCorrelation.matched, true)
assert.equal(exactCorrelation.matchType, 'correlation_id')
assert.equal(exactCorrelation.leadId, 'lead-exact')
assert.equal(exactCorrelation.outboundMessageId, 'exact-send')
assert.equal(exactCorrelation.providerMessageId, 'resend-correlation-1')

const threadMessage = {
  ...correlatedReplyMessage,
  id: 'thread-reply',
  conversationId: 'outlook-thread-1',
}
const threadCorrelation = correlateOutlookInbound(threadMessage, 'alias@example.com', [
  {
    source: 'send_event',
    leadId: 'lead-thread',
    strategyKey: 'funding_prep',
    recipient: 'different@example.com',
    outboundMessageId: 'internal-thread-1',
    occurredAt: outboundAt,
    metadata: {
      conversationId: 'outlook-thread-1',
      providerMessageId: 'resend-thread-1',
    },
  },
])
assert.equal(threadCorrelation.matchType, 'thread')
assert.equal(threadCorrelation.outboundMessageId, 'internal-thread-1')
assert.equal(threadCorrelation.providerMessageId, 'resend-thread-1')

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
