import assert from 'node:assert/strict'

import {
  assertGate3d1DetroitBusinessWindow,
  fingerprintGate3d1GraphReplyContent,
  fingerprintGate3d1GraphReplyThread,
  getGate3d1InboundMailboxScopeReadiness,
  getGate3d1GraphPermissionReadiness,
  hasExactGate3d1ReplyMemoryProvenance,
  isConservativePositiveSellerReplyText,
  isExplicitEmailOptOutText,
  isExactGate3d1GraphReplyCallback,
  resolveMicrosoftGraphAccessTokenTenantId,
  resolveGate3d1ExecutionOrStop,
  resolveGate3d1GraphApplicationClientId,
  runGate3d1GraphSameThreadReplyCanary,
  selectExactGate3d1LocalDraft,
  type Gate3d1GraphReplyDependencies,
  type Gate3d1GraphReplyRequest,
  type Gate3d1GraphThreadEvidence,
} from '@/lib/email/graphSameThreadReplyCore'
import type { OperatingStrategyBinding } from '@/lib/strategy/runtime-governance'

const requestBase = {
  leadId: '889146bd-8f16-4de0-bce1-01528d7f7882',
  replyMemoryId: '99999999-9999-4999-8999-999999999999',
  outreachMessageId: '11111111-1111-4111-8111-111111111111',
  recipientEmail: 'canary@example.com',
  recipientTimeZone: 'America/Detroit',
  propertyAddress: '123 Test Street, Detroit, MI',
  sourceNamespace: 'operating_strategy' as const,
  sourceIdentifier: 'seller_options_intake',
  operatingStrategyVersionId: '44444444-4444-4444-8444-444444444444',
  outreachPurpose: 'seller_reply_followup',
  messageVersionKey: 'approved-manifest-v1',
  authorizationId: '88888888-8888-4888-8888-888888888888',
  exchangeRbacAttestationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  approvalManifestKey: 'founder-approved-canary-v1',
  comment: 'Thank you for the reply. I am following up on the details you shared.',
  target: {
    mailboxObjectId: '22222222-2222-4222-8222-222222222222',
    mailboxAddress: 'acquisitions@vestblock.io',
    inboundImmutableMessageId: 'AAkALgAAAA-immutable-inbound',
    conversationId: 'AAQkAG-conversation-exact',
    inboundInternetMessageId: '<inbound@example.com>',
  },
}
const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const request: Gate3d1GraphReplyRequest = {
  ...requestBase,
  contentFingerprint: fingerprintGate3d1GraphReplyContent(requestBase),
  threadFingerprint: fingerprintGate3d1GraphReplyThread(requestBase),
  contractFingerprint: 'a'.repeat(32),
  reservationIdempotencyKey: 'gate3d1-canary-reservation-exact-once-v1',
  idempotencyKey: 'gate3d1-canary-exact-once-v1',
}

const binding: OperatingStrategyBinding = {
  namespace: 'operating_strategy',
  sourceIdentifier: 'seller_options_intake',
  portfolioKey: 'customer_lifecycle_growth',
  strategyKey: 'seller_options_intake',
  operatingStrategyId: '33333333-3333-4333-8333-333333333333',
  operatingStrategyVersionId: '44444444-4444-4444-8444-444444444444',
  version: 1,
  executionMode: 'approved_live',
  externalSendCap: 1,
  destinationMode: 'operator_handoff',
  destinationPath: null,
  ctaLabel: null,
  contractFingerprint: 'a'.repeat(32),
  crmOwnerKey: 'vestblock_crm',
  automationOwnerKey: 'vestblock_application',
  dispatchAuthority: 'vestblock_application',
}

const recoveryThread: Gate3d1GraphThreadEvidence = {
  mailboxObjectId: request.target.mailboxObjectId,
  mailboxAddress: request.target.mailboxAddress,
  recipientEmail: request.recipientEmail,
  targetInboundImmutableMessageId: request.target.inboundImmutableMessageId,
  targetConversationId: request.target.conversationId,
  targetInternetMessageId: request.target.inboundInternetMessageId,
  outboundImmutableMessageId: 'AAkALgAAAA-immutable-outbound',
  outboundInternetMessageId: '<outbound@vestblock.io>',
}

function readyGraphSession() {
  return {
    accessToken: 'test-token-never-sent',
    authMode: 'application_credentials' as const,
    grantedPermissions: [] as const,
    tenantId: '99999999-9999-4999-8999-999999999999',
    clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    scopedPermissionAttestation: {
      attestationId: request.exchangeRbacAttestationId,
      tenantId: '99999999-9999-4999-8999-999999999999',
      clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      mailboxObjectId: request.target.mailboxObjectId,
      mailboxAddress: request.target.mailboxAddress,
      roleNames: ['Application Mail.ReadWrite', 'Application Mail.Send'],
      outOfScopeMailboxObjectId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      founderReviewerUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      verifiedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      inScopeProofFingerprint: 'e'.repeat(64),
      outOfScopeDenyProofFingerprint: 'f'.repeat(64),
      attestationFingerprint: 'd'.repeat(32),
    },
  }
}

function makeDependencies(
  events: string[],
  overrides: Partial<Gate3d1GraphReplyDependencies> = {}
): Gate3d1GraphReplyDependencies {
  const base: Gate3d1GraphReplyDependencies = {
    now: () => new Date('2026-08-17T14:30:00.000Z'),
    assertActivation: () => { events.push('activation') },
    getGraphSession: async () => {
      events.push('graph_session')
      return readyGraphSession()
    },
    authorize: async () => {
      events.push('authorize')
      return binding
    },
    assertNoStopSignal: async (_input, phase) => {
      events.push(`stop:${phase}`)
      return {
        suppressionSnapshot: {
          suppressionCleared: true,
          checkedAt: '2026-08-17T14:30:00.000Z',
          evidenceKey: 'test-suppression-evidence',
        },
        market: 'Detroit, MI',
        propertyAddress: null,
      }
    },
    claimAuthorization: async () => {
      events.push('claim')
      return {
        claimId: '77777777-7777-4777-8777-777777777777',
        authorizationId: request.authorizationId,
        exchangeRbacAttestationId: request.exchangeRbacAttestationId,
        expiresAt: '2026-08-17T15:00:00.000Z',
        claimFingerprint: 'b'.repeat(32),
        consentBasisSnapshot: {
          basis: 'positive_inbound_reply_continuation',
          authorizationId: request.authorizationId,
          claimId: '77777777-7777-4777-8777-777777777777',
        },
      }
    },
    reserve: async () => {
      events.push('reserve')
      return { reservationId: '55555555-5555-4555-8555-555555555555' }
    },
    bindReservation: async () => { events.push('bind_reservation') },
    persistIntent: async () => {
      events.push('persist_intent')
      return {
        enrollmentId: '66666666-6666-4666-8666-666666666666',
        canonicalActivityId: '12121212-1212-4212-8212-121212121212',
      }
    },
    confirmIntent: async ({ intent }) => {
      events.push('confirm_intent')
      const recovery = intent as typeof intent & {
        state?:
          | 'draft_attempted'
          | 'draft_created'
          | 'send_attempted'
          | 'accepted'
          | 'ambiguous'
          | 'reconciled_accepted'
          | 'reconciled_not_sent'
          | 'dead_lettered'
      }
      return {
        ...intent,
        claimId: '77777777-7777-4777-8777-777777777777',
        state: recovery.state || 'intent_confirmed',
      }
    },
    assertProviderMutationAllowed: async ({ mutation }) => {
      events.push(`db_guard:${mutation}`)
    },
    getTargetMessage: async () => {
      assert.equal(events.includes('persist_intent'), true, 'Graph must not be called before durable intent')
      events.push('graph_get_target')
      return {
        id: request.target.inboundImmutableMessageId,
        conversationId: request.target.conversationId,
        internetMessageId: request.target.inboundInternetMessageId,
        fromAddress: request.recipientEmail,
        toAddresses: [request.target.mailboxAddress],
      }
    },
    getOutboundMessage: async () => {
      events.push('graph_get_outbound')
      if (!events.includes('graph_send')) throw new Error('Unexpected recovery lookup.')
      return {
        id: recoveryThread.outboundImmutableMessageId,
        conversationId: recoveryThread.targetConversationId,
        internetMessageId: recoveryThread.outboundInternetMessageId,
        fromAddress: recoveryThread.mailboxAddress,
        toAddresses: [recoveryThread.recipientEmail],
        ccAddresses: [],
        bccAddresses: [],
        isDraft: false,
        sentDateTime: '2026-08-17T14:30:10.000Z',
      }
    },
    createReplyDraft: async () => {
      events.push('graph_create_reply')
      return {
        id: 'AAkALgAAAA-immutable-outbound',
        conversationId: request.target.conversationId,
        internetMessageId: '<outbound@vestblock.io>',
        fromAddress: request.target.mailboxAddress,
        toAddresses: [request.recipientEmail],
        isDraft: true,
      }
    },
    beginDraftAttempt: async () => { events.push('begin_draft_attempt') },
    persistDraftIdentity: async () => { events.push('persist_draft') },
    recordDraftResult: async ({ outcome }) => { events.push(`record_draft:${outcome}`) },
    beginSendAttempt: async () => { events.push('begin_send_attempt') },
    sendReplyDraft: async () => {
      assert.equal(events.at(-1), 'begin_send_attempt')
      assert.equal(events.at(-2), 'db_guard:send')
      events.push('graph_send')
      return { status: 202 }
    },
    persistAccepted: async () => { events.push('persist_accepted') },
    recordSendResult: async ({ outcome }) => { events.push(`record_send:${outcome}`) },
    ensureStopsEngaged: async ({ phase }) => { events.push(`ensure_stops:${phase}`) },
    failClosed: async ({ failurePhase }) => { events.push(`fail_closed:${failurePhase}`) },
  }
  return { ...base, ...overrides }
}

function hasGraphResourceCall(events: string[]) {
  return events.some((event) => [
    'graph_get_target',
    'graph_get_outbound',
    'graph_create_reply',
    'graph_send',
  ].includes(event))
}

async function main() {
{
  const events: string[] = []
  const result = await runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events))
  assert.equal(result.ok, true)
  assert.equal(result.provider, 'outlook_graph')
  assert.ok(events.indexOf('graph_session') > events.indexOf('confirm_intent'))
  assert.deepEqual(events, [
    'activation',
    'authorize',
    'stop:before_reservation',
    'claim',
    'reserve',
    'bind_reservation',
    'persist_intent',
    'confirm_intent',
    'graph_session',
    'graph_get_target',
    'activation',
    'stop:before_create_reply',
    'db_guard:create_reply',
    'begin_draft_attempt',
    'graph_create_reply',
    'persist_draft',
    'record_draft:draft_created',
    'activation',
    'stop:before_send',
    'db_guard:send',
    'begin_send_attempt',
    'graph_send',
    'graph_get_outbound',
    'record_send:accepted',
    'persist_accepted',
    'ensure_stops:accepted_delivery',
  ])
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary({
      ...request,
      contractFingerprint: 'a'.repeat(64),
    }, makeDependencies(events)),
    /32-character contract fingerprint/
  )
  assert.deepEqual(events, [])
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary({
      ...request,
      recipientTimeZone: 'not/a-real-zone',
    }, makeDependencies(events)),
    /IANA time-zone identifier/
  )
  assert.deepEqual(events, [])
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      getGraphSession: async () => ({
        accessToken: 'test-token-never-sent',
        authMode: 'application_credentials',
        grantedPermissions: [],
      }),
    })),
    /missing dedicated app-only token/
  )
  assert.equal(hasGraphResourceCall(events), false)
  assert.equal(events.includes('persist_intent'), true)
  assert.equal(events.includes('fail_closed:graph_session_readiness'), true)
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      now: () => new Date('2026-08-16T14:30:00.000Z'),
    })),
    /blocked on weekends/
  )
  assert.deepEqual(events, ['activation', 'fail_closed:initial_preflight'])
}

assert.throws(
  () => assertGate3d1DetroitBusinessWindow(new Date('2026-08-17T14:29:00.000Z')),
  /10:30 through 16:29/
)
assert.doesNotThrow(
  () => assertGate3d1DetroitBusinessWindow(new Date('2026-08-17T14:30:00.000Z'))
)
assert.throws(
  () => assertGate3d1DetroitBusinessWindow(new Date('2026-08-17T20:30:00.000Z')),
  /10:30 through 16:29/
)

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      assertNoStopSignal: async (_input, phase) => {
        events.push(`stop:${phase}`)
        throw new Error('explicit_opt_out')
      },
    })),
    /explicit_opt_out/
  )
  assert.equal(hasGraphResourceCall(events), false)
  assert.equal(events.includes('reserve'), false)
}

for (const stopReason of ['bounced', 'complained', 'newer_reply_received']) {
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      assertNoStopSignal: async (_input, phase) => {
        events.push(`stop:${phase}`)
        throw new Error(stopReason)
      },
    })),
    new RegExp(stopReason)
  )
  assert.equal(hasGraphResourceCall(events), false)
}

{
  const events: string[] = []
  const dependencies = makeDependencies(events)
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, {
      ...dependencies,
      getTargetMessage: async () => {
        events.push('graph_get_target')
        return {
          id: request.target.inboundImmutableMessageId,
          conversationId: 'wrong-conversation',
          internetMessageId: request.target.inboundInternetMessageId,
          fromAddress: request.recipientEmail,
          toAddresses: [request.target.mailboxAddress],
        }
      },
    }),
    /no longer matches/
  )
  assert.equal(events.includes('graph_create_reply'), false)
  assert.equal(events.includes('graph_send'), false)
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      createReplyDraft: async () => {
        events.push('graph_create_reply')
        return {
          id: recoveryThread.outboundImmutableMessageId,
          conversationId: request.target.conversationId,
          internetMessageId: recoveryThread.outboundInternetMessageId,
          fromAddress: request.target.mailboxAddress,
          toAddresses: [request.recipientEmail],
          ccAddresses: ['unexpected@example.com'],
          bccAddresses: [],
          isDraft: true,
        }
      },
    })),
    /same-thread immutable reply draft identity/
  )
  assert.equal(events.includes('record_draft:ambiguous'), true)
  assert.equal(events.includes('graph_send'), false)
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      createReplyDraft: async () => {
        events.push('graph_create_reply_timeout')
        throw new Error('injected_create_reply_timeout_before_response')
      },
      recordDraftResult: async ({ outcome, thread }) => {
        assert.equal(outcome, 'ambiguous')
        assert.equal(thread, null)
        events.push(`record_draft:${outcome}:without_identity`)
      },
    })),
    /injected_create_reply_timeout_before_response/
  )
  assert.equal(events.includes('begin_draft_attempt'), true)
  assert.equal(events.includes('record_draft:ambiguous:without_identity'), true)
  assert.equal(events.includes('fail_closed:graph_create_reply'), true)
  assert.equal(events.includes('graph_send'), false)
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      persistDraftIdentity: async () => {
        events.push('persist_draft_failed')
        throw new Error('injected_draft_persistence_failure')
      },
    })),
    /injected_draft_persistence_failure/
  )
  assert.equal(events.includes('graph_create_reply'), true)
  assert.equal(events.includes('graph_send'), false)
}

{
  const events: string[] = []
  const result = await runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
    persistIntent: async () => {
      events.push('recover_intent')
      return {
        enrollmentId: '66666666-6666-4666-8666-666666666666',
        canonicalActivityId: '12121212-1212-4212-8212-121212121212',
        claimId: '77777777-7777-4777-8777-777777777777',
        state: 'draft_created',
        dispatchIntentAt: '2026-08-17T14:29:50.000Z',
        existingThread: recoveryThread,
      }
    },
    getOutboundMessage: async () => {
      events.push('graph_get_outbound')
      return {
        id: recoveryThread.outboundImmutableMessageId,
        conversationId: recoveryThread.targetConversationId,
        internetMessageId: recoveryThread.outboundInternetMessageId,
        fromAddress: recoveryThread.mailboxAddress,
        toAddresses: [recoveryThread.recipientEmail],
        isDraft: !events.includes('graph_send'),
        sentDateTime: events.includes('graph_send') ? '2026-08-17T14:30:10.000Z' : null,
      }
    },
  }))
  assert.equal(result.ok, true)
  assert.equal(events.includes('graph_get_target'), false)
  assert.equal(events.includes('graph_create_reply'), false)
  assert.equal(events.filter((event) => event === 'graph_send').length, 1)
}

for (const recoveryState of ['accepted', 'reconciled_accepted'] as const) {
  const events: string[] = []
  const result = await runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
    persistIntent: async () => {
      events.push('recover_intent')
      return {
        enrollmentId: '66666666-6666-4666-8666-666666666666',
        canonicalActivityId: '12121212-1212-4212-8212-121212121212',
        claimId: '77777777-7777-4777-8777-777777777777',
        state: recoveryState,
        dispatchIntentAt: '2026-08-17T14:29:50.000Z',
        existingThread: recoveryThread,
      }
    },
    getOutboundMessage: async () => {
      events.push('graph_get_outbound')
      return {
        id: recoveryThread.outboundImmutableMessageId,
        conversationId: recoveryThread.targetConversationId,
        internetMessageId: recoveryThread.outboundInternetMessageId,
        fromAddress: recoveryThread.mailboxAddress,
        toAddresses: [recoveryThread.recipientEmail],
        isDraft: false,
        sentDateTime: '2026-08-17T14:30:10.000Z',
      }
    },
  }))
  assert.equal(result.ok, true)
  assert.equal('reconciledWithoutSend' in result && result.reconciledWithoutSend, true)
  assert.equal(events.includes('graph_create_reply'), false)
  assert.equal(events.includes('graph_send'), false)
  assert.equal(events.includes('persist_accepted'), true)
  assert.equal(events.includes('ensure_stops:accepted_recovery'), true)
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      persistIntent: async () => ({
        enrollmentId: '66666666-6666-4666-8666-666666666666',
        canonicalActivityId: '12121212-1212-4212-8212-121212121212',
        state: 'draft_created',
        existingThread: recoveryThread,
      }),
      getOutboundMessage: async () => {
        events.push('graph_get_outbound_sent_before_permit')
        return {
          id: recoveryThread.outboundImmutableMessageId,
          conversationId: recoveryThread.targetConversationId,
          internetMessageId: recoveryThread.outboundInternetMessageId,
          fromAddress: recoveryThread.mailboxAddress,
          toAddresses: [recoveryThread.recipientEmail],
          ccAddresses: [],
          bccAddresses: [],
          isDraft: false,
          sentDateTime: '2026-08-17T14:30:10.000Z',
        }
      },
    })),
    /sent Graph message was observed before the one-shot send permit/
  )
  assert.equal(events.includes('begin_send_attempt'), false)
  assert.equal(events.includes('record_send:accepted'), false)
  assert.equal(events.includes('fail_closed:draft_recovery'), true)
}

{
  const events: string[] = []
  const result = await runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
    persistIntent: async () => {
      events.push('recover_send_attempt')
      return {
        enrollmentId: '66666666-6666-4666-8666-666666666666',
        canonicalActivityId: '12121212-1212-4212-8212-121212121212',
        claimId: '77777777-7777-4777-8777-777777777777',
        state: 'send_attempted',
        dispatchIntentAt: '2026-08-17T14:29:50.000Z',
        existingThread: recoveryThread,
      }
    },
    getOutboundMessage: async () => {
      events.push('graph_get_outbound')
      return {
        id: recoveryThread.outboundImmutableMessageId,
        conversationId: recoveryThread.targetConversationId,
        internetMessageId: recoveryThread.outboundInternetMessageId,
        fromAddress: recoveryThread.mailboxAddress,
        toAddresses: [recoveryThread.recipientEmail],
        ccAddresses: [],
        bccAddresses: [],
        isDraft: true,
      }
    },
  }))
  assert.equal(result.ok, false)
  assert.equal(result.reconciliationRequired, true)
  assert.equal(events.includes('graph_create_reply'), false)
  assert.equal(events.includes('graph_send'), false)
}

{
  const events: string[] = []
  const result = await runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
    persistIntent: async () => ({
      enrollmentId: '66666666-6666-4666-8666-666666666666',
      canonicalActivityId: '12121212-1212-4212-8212-121212121212',
      state: 'dead_lettered',
    }),
  }))
  assert.equal(result.ok, false)
  assert.equal(result.reconciliationRequired, false)
  assert.equal(events.includes('graph_session'), false)
  assert.equal(events.includes('fail_closed:terminal_dead_lettered'), true)
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      getOutboundMessage: async () => {
        events.push('graph_get_outbound')
        return {
          id: recoveryThread.outboundImmutableMessageId,
          conversationId: recoveryThread.targetConversationId,
          internetMessageId: recoveryThread.outboundInternetMessageId,
          fromAddress: recoveryThread.mailboxAddress,
          toAddresses: [recoveryThread.recipientEmail],
          ccAddresses: [],
          bccAddresses: [],
          isDraft: true,
        }
      },
    })),
    /still resolves to a draft/
  )
  assert.equal(events.includes('graph_send'), true)
  assert.equal(events.includes('record_send:ambiguous'), true)
  assert.equal(events.includes('persist_accepted'), false)
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      assertProviderMutationAllowed: async ({ mutation }) => {
        events.push(`db_guard:${mutation}`)
        if (mutation === 'send') throw new Error('injected_kill_switch')
      },
    })),
    /injected_kill_switch/
  )
  assert.equal(events.includes('persist_draft'), true)
  assert.equal(events.includes('graph_send'), false)
  assert.equal(events.includes('fail_closed:before_send_recheck'), true)
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      beginSendAttempt: async () => {
        events.push('begin_send_attempt')
        throw new Error('provider_draft_id_hash_mismatch')
      },
    })),
    /provider_draft_id_hash_mismatch/
  )
  assert.equal(events.includes('graph_send'), false)
  assert.equal(events.includes('fail_closed:begin_send_attempt'), true)
}

{
  const events: string[] = []
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, makeDependencies(events, {
      getOutboundMessage: async () => {
        events.push('graph_get_outbound')
        if (events.includes('graph_send')) throw new Error('Graph 404 eventual consistency')
        throw new Error('Unexpected recovery lookup.')
      },
    })),
    /exact immutable-ID reconciliation is required/
  )
  assert.equal(events.filter((event) => event === 'graph_send').length, 1)
  assert.equal(events.includes('record_send:ambiguous'), true)
  assert.equal(events.includes('persist_accepted'), false)
  assert.equal(events.includes('fail_closed:post_send_reconciliation'), true)
}

{
  const events: string[] = []
  const dependencies = makeDependencies(events)
  await assert.rejects(
    runGate3d1GraphSameThreadReplyCanary(request, {
      ...dependencies,
      assertNoStopSignal: async (input, phase) => {
        const evidence = await dependencies.assertNoStopSignal(input, phase)
        if (phase === 'before_send') throw new Error('reply_arrived_after_draft')
        return evidence
      },
    }),
    /reply_arrived_after_draft/
  )
  assert.equal(events.includes('persist_draft'), true)
  assert.equal(events.includes('graph_send'), false)
}

assert.equal(
  getGate3d1GraphPermissionReadiness({
    authMode: 'application_credentials',
    grantedPermissions: ['Mail.Send', 'Mail.ReadWrite'],
  }).ready,
  false
)
assert.equal(
  getGate3d1GraphPermissionReadiness({
    authMode: 'application_credentials',
    grantedPermissions: ['User.Read.All'],
  }).ready,
  false
)
assert.equal(
  getGate3d1GraphPermissionReadiness({
    authMode: 'application_credentials',
    grantedPermissions: [],
    tenantId: '99999999-9999-4999-8999-999999999999',
    clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    requiredMailboxObjectId: request.target.mailboxObjectId,
    requiredMailboxAddress: request.target.mailboxAddress,
    scopedPermissionAttestation: {
      attestationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      tenantId: '99999999-9999-4999-8999-999999999999',
      clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      mailboxObjectId: request.target.mailboxObjectId,
      mailboxAddress: request.target.mailboxAddress,
      roleNames: ['Application Mail.ReadWrite', 'Application Mail.Send'],
      outOfScopeMailboxObjectId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      founderReviewerUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      verifiedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      inScopeProofFingerprint: 'e'.repeat(64),
      outOfScopeDenyProofFingerprint: 'f'.repeat(64),
      attestationFingerprint: 'd'.repeat(32),
    },
  }).ready,
  true
)

assert.equal(
  resolveGate3d1GraphApplicationClientId({
    tokenVersion: '2.0',
    authorizedPartyClientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    applicationClientId: null,
    expectedClientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  }),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
)
assert.equal(
  resolveGate3d1GraphApplicationClientId({
    tokenVersion: '1.0',
    authorizedPartyClientId: null,
    applicationClientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    expectedClientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  }),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
)
assert.throws(
  () => resolveGate3d1GraphApplicationClientId({
    tokenVersion: '2.0',
    authorizedPartyClientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    applicationClientId: null,
    expectedClientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  }),
  /does not match the dedicated/
)
assert.throws(
  () => resolveGate3d1GraphApplicationClientId({
    tokenVersion: '2.0',
    authorizedPartyClientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    applicationClientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    expectedClientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  }),
  /conflicting application client identities/
)
assert.throws(
  () => resolveGate3d1GraphApplicationClientId({
    tokenVersion: '2.0',
    authorizedPartyClientId: null,
    applicationClientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    expectedClientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  }),
  /unsupported/
)

const thread = recoveryThread
const callback = {
  mailboxObjectId: request.target.mailboxObjectId,
  mailboxAddress: request.target.mailboxAddress,
  immutableMessageId: 'AAkALgAAAA-immutable-callback',
  conversationId: request.target.conversationId,
  internetMessageId: '<callback@example.com>',
  fromAddress: request.recipientEmail,
  toAddresses: [request.target.mailboxAddress],
  internetMessageHeaders: [{ name: 'In-Reply-To', value: thread.outboundInternetMessageId }],
}
assert.equal(isExactGate3d1GraphReplyCallback(callback, thread), true)
assert.equal(
  isExactGate3d1GraphReplyCallback({ ...callback, conversationId: 'wrong' }, thread),
  false
)
assert.equal(
  isExactGate3d1GraphReplyCallback({
    ...callback,
    internetMessageHeaders: [{ name: 'In-Reply-To', value: '<different@vestblock.io>' }],
  }, thread),
  false
)
assert.equal(
  isExactGate3d1GraphReplyCallback({
    ...callback,
    internetMessageHeaders: [{ name: 'References', value: thread.outboundInternetMessageId }],
  }, thread),
  false
)
assert.equal(
  isExactGate3d1GraphReplyCallback({ ...callback, mailboxObjectId: '77777777-7777-4777-8777-777777777777' }, thread),
  false
)

assert.deepEqual(
  getGate3d1InboundMailboxScopeReadiness({
    inboundTenantId: tenantId,
    dedicatedTenantId: tenantId,
    inboundMailboxObjectId: request.target.mailboxObjectId,
    inboundMailboxAddress: request.target.mailboxAddress,
    dedicatedMailboxObjectId: request.target.mailboxObjectId,
    dedicatedMailboxAddress: request.target.mailboxAddress,
  }),
  {
    ready: true,
    blocker: null,
    observedMailboxObjectId: request.target.mailboxObjectId,
    observedMailboxAddress: request.target.mailboxAddress,
    observedTenantId: null,
  }
)
assert.equal(
  getGate3d1InboundMailboxScopeReadiness({
    inboundTenantId: tenantId,
    dedicatedTenantId: tenantId,
    inboundMailboxObjectId: '',
    inboundMailboxAddress: request.target.mailboxAddress,
    dedicatedMailboxObjectId: request.target.mailboxObjectId,
    dedicatedMailboxAddress: request.target.mailboxAddress,
  }).ready,
  false
)
assert.equal(
  getGate3d1InboundMailboxScopeReadiness({
    inboundTenantId: tenantId,
    dedicatedTenantId: tenantId,
    inboundMailboxObjectId: '77777777-7777-4777-8777-777777777777',
    inboundMailboxAddress: request.target.mailboxAddress,
    dedicatedMailboxObjectId: request.target.mailboxObjectId,
    dedicatedMailboxAddress: request.target.mailboxAddress,
  }).ready,
  false
)
assert.equal(
  getGate3d1InboundMailboxScopeReadiness({
    inboundTenantId: tenantId,
    dedicatedTenantId: tenantId,
    inboundMailboxObjectId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
    inboundMailboxAddress: request.target.mailboxAddress,
    dedicatedMailboxObjectId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    dedicatedMailboxAddress: request.target.mailboxAddress,
  }).ready,
  false
)
assert.equal(
  getGate3d1InboundMailboxScopeReadiness({
    inboundTenantId: '',
    dedicatedTenantId: tenantId,
    inboundMailboxObjectId: request.target.mailboxObjectId,
    inboundMailboxAddress: request.target.mailboxAddress,
    dedicatedMailboxObjectId: request.target.mailboxObjectId,
    dedicatedMailboxAddress: request.target.mailboxAddress,
  }).ready,
  false
)
assert.equal(
  getGate3d1InboundMailboxScopeReadiness({
    inboundTenantId: tenantId,
    dedicatedTenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    inboundMailboxObjectId: request.target.mailboxObjectId,
    inboundMailboxAddress: request.target.mailboxAddress,
    dedicatedMailboxObjectId: request.target.mailboxObjectId,
    dedicatedMailboxAddress: request.target.mailboxAddress,
  }).ready,
  false
)
assert.equal(
  getGate3d1InboundMailboxScopeReadiness({
    inboundTenantId: tenantId,
    dedicatedTenantId: tenantId,
    observedTokenTenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    inboundMailboxObjectId: request.target.mailboxObjectId,
    inboundMailboxAddress: request.target.mailboxAddress,
    dedicatedMailboxObjectId: request.target.mailboxObjectId,
    dedicatedMailboxAddress: request.target.mailboxAddress,
  }).ready,
  false
)
const token = [
  Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
  Buffer.from(JSON.stringify({ tid: tenantId })).toString('base64url'),
  'signature',
].join('.')
assert.equal(resolveMicrosoftGraphAccessTokenTenantId(token), tenantId)
assert.throws(
  () => resolveMicrosoftGraphAccessTokenTenantId('not-a-jwt'),
  /verifiable JWT/
)

for (const command of ['STOP', ' stop! ', 'END', 'Cancel.', 'UNSUBSCRIBE', 'QUIT']) {
  assert.equal(
    isExplicitEmailOptOutText({ subject: 'Re: property question', bodyPreview: command }),
    true,
    `${command} must be treated as an explicit opt-out command.`
  )
  assert.equal(
    isConservativePositiveSellerReplyText({ subject: 'Re: selling my house', bodyPreview: command }),
    false
  )
}
assert.equal(
  isExplicitEmailOptOutText({
    subject: 'Re: STOP',
    bodyPreview: 'This signature text must not override the exact subject command.',
  }),
  true,
  'An exact STOP subject must suppress even when the body or signature is nonblank.'
)
for (const optOutText of [
  'Please stop.',
  'Stop sending me emails.',
  'Stop sending messages',
  'No more emails please.',
  'Take me off your list.',
]) {
  assert.equal(
    isExplicitEmailOptOutText({ subject: 'Re: property question', bodyPreview: optOutText }),
    true,
    `Unambiguous opt-out text must suppress: ${optOutText}`
  )
}
assert.equal(
  isExplicitEmailOptOutText({
    subject: 'Re: property question',
    bodyPreview: '> If you prefer not to receive further messages, reply STOP and we will honor your request.',
  }),
  false,
  'A quoted footer alone must not falsely suppress a normal recipient.'
)
assert.equal(
  isExplicitEmailOptOutText({
    subject: 'Re: property question',
    bodyPreview: 'Yes, please call me.\n\n> If you prefer not to receive further messages, reply STOP.',
  }),
  false
)
assert.equal(
  isConservativePositiveSellerReplyText({
    subject: 'Re: property question',
    bodyPreview: 'Yes, I am open to an offer. Please call me.',
  }),
  true
)
for (const negativeReply of [
  'No thanks, I am not interested.',
  'Wrong person.',
  'I am not selling my house.',
  'Maybe.',
]) {
  assert.equal(
    isConservativePositiveSellerReplyText({
      subject: 'Re: interested in your property',
      bodyPreview: negativeReply,
    }),
    false,
    `Negative or ambiguous reply must not become positive evidence: ${negativeReply}`
  )
}

const exactReplyMemoryProvenance = {
  observedTenantId: tenantId,
  observedMailboxObjectId: request.target.mailboxObjectId,
}
assert.equal(
  hasExactGate3d1ReplyMemoryProvenance(exactReplyMemoryProvenance, {
    tenantId,
    mailboxObjectId: request.target.mailboxObjectId,
  }),
  true
)
assert.equal(
  hasExactGate3d1ReplyMemoryProvenance({}, {
    tenantId,
    mailboxObjectId: request.target.mailboxObjectId,
  }),
  false,
  'A pre-fix reply-memory row without observed reader provenance must fail closed.'
)
assert.equal(
  hasExactGate3d1ReplyMemoryProvenance({
    ...exactReplyMemoryProvenance,
    observedTenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  }, {
    tenantId,
    mailboxObjectId: request.target.mailboxObjectId,
  }),
  false
)
assert.equal(
  hasExactGate3d1ReplyMemoryProvenance({
    ...exactReplyMemoryProvenance,
    observedMailboxObjectId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  }, {
    tenantId,
    mailboxObjectId: request.target.mailboxObjectId,
  }),
  false
)

const historicalOutreach = [
  {
    id: 'history-1',
    lead_id: request.leadId,
    channel: 'email',
    generated_with: 'legacy_seller_outreach',
    variant_key: 'legacy-v1',
    status: 'sent',
  },
  {
    id: 'history-2',
    lead_id: request.leadId,
    channel: 'email',
    generated_with: 'another_historical_writer',
    variant_key: 'historical-v2',
    status: 'replied',
  },
]
assert.equal(
  selectExactGate3d1LocalDraft(historicalOutreach, {
    leadId: request.leadId,
    generator: 'gate3d1_graph_reply_v1',
    messageVersionKey: request.messageVersionKey,
  }),
  null,
  'Historical sent/replied outreach must not be selected or mutated when a new Gate 3D.1 draft is inserted.'
)
const exactDraft = {
  id: 'gate3d1-draft',
  lead_id: request.leadId,
  channel: 'email',
  generated_with: 'gate3d1_graph_reply_v1',
  variant_key: request.messageVersionKey,
  status: 'needs_review',
}
assert.equal(
  selectExactGate3d1LocalDraft([...historicalOutreach, exactDraft], {
    leadId: request.leadId,
    generator: 'gate3d1_graph_reply_v1',
    messageVersionKey: request.messageVersionKey,
  }),
  exactDraft
)
assert.throws(
  () => selectExactGate3d1LocalDraft([...historicalOutreach, exactDraft, {
    ...exactDraft,
    id: 'gate3d1-duplicate',
  }], {
    leadId: request.leadId,
    generator: 'gate3d1_graph_reply_v1',
    messageVersionKey: request.messageVersionKey,
  }),
  /ambiguous exact local drafts/
)

for (const preCoreFailure of [
  'authorization_expired',
  'active_suppression',
  'newer_reply_received',
  'approved_content_fingerprint_conflict',
]) {
  const events: string[] = []
  await assert.rejects(
    resolveGate3d1ExecutionOrStop({
      resolve: async () => {
        events.push('resolve_manifest')
        throw new Error(preCoreFailure)
      },
      engageStops: async () => {
        events.push('engage_global_and_strategy_stops')
      },
    }),
    new RegExp(preCoreFailure)
  )
  assert.deepEqual(events, ['resolve_manifest', 'engage_global_and_strategy_stops'])
  assert.equal(events.includes('graph_create_reply'), false)
  assert.equal(events.includes('graph_send'), false)
}

await assert.rejects(
  resolveGate3d1ExecutionOrStop({
    resolve: async () => { throw new Error('manifest_failure') },
    engageStops: async () => { throw new Error('stop_confirmation_failure') },
  }),
  /manifest resolution failed and both stops could not be confirmed: stop_confirmation_failure/
)

console.log('Gate 3D.1 exact Microsoft Graph same-thread reply checks passed.')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
