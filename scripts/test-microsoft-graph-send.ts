import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  getMicrosoftGraphFailureDisposition,
  hasMicrosoftGraphApplicationCredentials,
  prefersMicrosoftGraphTransactionalEmail,
  sendTransactionalEmailWithMicrosoftGraph,
  sendTransactionalEmailWithMicrosoftGraphIdempotently,
  type MicrosoftGraphDispatchLedger,
} from '../lib/email/microsoftGraphSend'
import {
  buildOutlookTransactionalDispatchIdentity,
  type OutlookTransactionalDispatchIdentity,
  type OutlookTransactionalDispatchOutcome,
} from '../lib/email/transactionalEmailDispatchCore'

const env = {
  MICROSOFT_GRAPH_CLIENT_ID: 'test-client-id',
  MICROSOFT_GRAPH_CLIENT_SECRET: 'test-client-secret',
  MICROSOFT_TENANT_ID: 'test-tenant-id',
  OUTLOOK_ACQUISITIONS_MAILBOX: 'acquisitions@vestblock.io',
}
const draftIdentity = {
  id: 'graph-message-1',
  internetMessageId: '<vestblock-graph-message-1@example.test>',
}

assert.equal(hasMicrosoftGraphApplicationCredentials(env), true)
assert.equal(
  hasMicrosoftGraphApplicationCredentials({ ...env, OUTLOOK_ACQUISITIONS_MAILBOX: '' }),
  false
)
assert.equal(
  prefersMicrosoftGraphTransactionalEmail('resend', { TRANSACTIONAL_EMAIL_PROVIDER: 'outlook' }),
  true,
  'the Outlook-only environment policy must override legacy caller preferences'
)
assert.equal(
  prefersMicrosoftGraphTransactionalEmail('google', { TRANSACTIONAL_EMAIL_PROVIDER: 'outlook' }),
  true
)
assert.equal(
  prefersMicrosoftGraphTransactionalEmail(undefined, {}),
  true,
  'missing provider configuration must still default to Outlook'
)
assert.equal(
  prefersMicrosoftGraphTransactionalEmail('resend', { TRANSACTIONAL_EMAIL_PROVIDER: 'outlok' }),
  true,
  'a mistyped provider variable must fail closed to Outlook rather than activate Resend'
)
assert.equal(
  prefersMicrosoftGraphTransactionalEmail('google', {
    NODE_ENV: 'production',
    ALLOW_LEGACY_EMAIL_PROVIDER_OVERRIDE: 'true',
  }),
  true,
  'legacy provider override must be ignored in production'
)
assert.equal(
  prefersMicrosoftGraphTransactionalEmail('resend', {
    NODE_ENV: 'test',
    VERCEL_ENV: 'production',
    ALLOW_LEGACY_EMAIL_PROVIDER_OVERRIDE: 'true',
  }),
  true,
  'a Vercel production deployment must ignore the legacy override even if NODE_ENV is misconfigured'
)
assert.equal(
  prefersMicrosoftGraphTransactionalEmail('resend', {
    NODE_ENV: 'development',
    ALLOW_LEGACY_EMAIL_PROVIDER_OVERRIDE: 'true',
  }),
  false,
  'legacy providers require an explicit non-production override'
)

const fingerprintInput = {
  to: 'ADMIN@example.test',
  subject: 'Stable payload',
  html: '<p>Same logical message.</p>',
  replyTo: 'acquisitions@vestblock.io',
  eventType: 'admin_lead_run_daily_report',
}
const fingerprint = buildOutlookTransactionalDispatchIdentity(fingerprintInput)
assert.equal(
  fingerprint.idempotencyKeyHash,
  buildOutlookTransactionalDispatchIdentity({ ...fingerprintInput, to: 'admin@example.test' }).idempotencyKeyHash
)
const withAttachment = buildOutlookTransactionalDispatchIdentity({
  ...fingerprintInput,
  attachments: [{ filename: 'packet.pdf', contentType: 'application/pdf', contentBase64: 'cGRm' }],
})
assert.notEqual(fingerprint.payloadHash, withAttachment.payloadHash)

function successfulFetch(calls: Array<{ url: string; init?: RequestInit }>) {
  return (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (url.includes('/oauth2/v2.0/token')) {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.endsWith('/messages')) {
      return new Response(JSON.stringify(draftIdentity), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.endsWith('/messages/graph-message-1/send')) {
      return new Response(null, { status: 202 })
    }
    throw new Error(`Unexpected test URL: ${url}`)
  }) as typeof fetch
}

async function main() {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const recordedDrafts: Array<{ graphMessageId: string; internetMessageId: string }> = []
  const accepted = await sendTransactionalEmailWithMicrosoftGraph(
    {
      to: 'admin@example.test, owner@example.test',
      subject: 'Daily operating report',
      html: '<p>Ready.</p>',
      replyTo: 'acquisitions@vestblock.io',
      correlationId: 'correlation-123',
      attachments: [{ filename: 'packet.pdf', contentType: 'application/pdf', contentBase64: 'cGRm' }],
    },
    {
      env,
      fetchImpl: successfulFetch(calls),
      recordDraft: async (identity) => recordedDrafts.push(identity),
    }
  )
  assert.deepEqual(accepted, {
    accepted: true,
    acceptance: 'accepted',
    providerMessageId: draftIdentity.id,
    graphMessageId: draftIdentity.id,
    internetMessageId: draftIdentity.internetMessageId,
  })
  assert.equal(calls.length, 3)
  assert.equal(calls[0].url, 'https://login.microsoftonline.com/test-tenant-id/oauth2/v2.0/token')
  assert.equal(calls[1].url, 'https://graph.microsoft.com/v1.0/users/acquisitions%40vestblock.io/messages')
  assert.equal(calls[2].url, 'https://graph.microsoft.com/v1.0/users/acquisitions%40vestblock.io/messages/graph-message-1/send')
  assert.deepEqual(recordedDrafts, [{
    graphMessageId: draftIdentity.id,
    internetMessageId: draftIdentity.internetMessageId,
  }])
  const draftBody = JSON.parse(String(calls[1].init?.body))
  assert.equal(draftBody.from.emailAddress.address, env.OUTLOOK_ACQUISITIONS_MAILBOX)
  assert.deepEqual(
    draftBody.toRecipients.map((recipient: { emailAddress: { address: string } }) => recipient.emailAddress.address),
    ['admin@example.test', 'owner@example.test']
  )
  assert.deepEqual(draftBody.internetMessageHeaders, [
    { name: 'X-VestBlock-Correlation-ID', value: 'correlation-123' },
  ])
  assert.equal(draftBody.attachments[0]['@odata.type'], '#microsoft.graph.fileAttachment')

  let state: 'new' | 'accepted' = 'new'
  let persistedGraphIdentity: typeof draftIdentity | null = null
  const claimedIdentities: OutlookTransactionalDispatchIdentity[] = []
  const finalizations: OutlookTransactionalDispatchOutcome[] = []
  const ledger: MicrosoftGraphDispatchLedger = {
    claim: async (identity) => {
      claimedIdentities.push(identity)
      if (state === 'accepted') {
        return {
          action: 'deduplicated_accepted',
          dispatchId: 'dispatch-1',
          dispatchToken: null,
          state: 'accepted',
          graphMessageId: persistedGraphIdentity?.id || null,
          internetMessageId: persistedGraphIdentity?.internetMessageId || null,
        }
      }
      return {
        action: 'send',
        dispatchId: 'dispatch-1',
        dispatchToken: 'token-1',
        state: 'dispatching',
      }
    },
    recordDraft: async (identity) => {
      persistedGraphIdentity = {
        id: identity.graphMessageId,
        internetMessageId: identity.internetMessageId,
      }
    },
    finalize: async (input) => {
      finalizations.push(input.outcome)
      if (input.outcome === 'accepted') state = 'accepted'
    },
  }
  const durableCalls: Array<{ url: string; init?: RequestInit }> = []
  const idempotentInput = {
    to: 'admin@example.test',
    subject: 'Daily operating report',
    html: '<p>Ready.</p>',
    replyTo: 'acquisitions@vestblock.io',
    eventType: 'admin_lead_run_daily_report',
    idempotencyKey: 'daily-report:2026-09-15',
  }
  const first = await sendTransactionalEmailWithMicrosoftGraphIdempotently(
    idempotentInput,
    { env, fetchImpl: successfulFetch(durableCalls), ledger }
  )
  assert.equal(first.accepted, true)
  assert.equal(first.deduplicated, false)
  assert.equal(first.dispatchId, 'dispatch-1')
  assert.equal(first.providerMessageId, draftIdentity.id)
  assert.equal(first.internetMessageId, draftIdentity.internetMessageId)
  assert.deepEqual(finalizations, ['accepted'])
  assert.equal(claimedIdentities[0].idempotencyKeySource, 'caller')

  const duplicate = await sendTransactionalEmailWithMicrosoftGraphIdempotently(
    idempotentInput,
    { env, fetchImpl: successfulFetch(durableCalls), ledger }
  )
  assert.equal(duplicate.deduplicated, true)
  assert.equal(duplicate.providerMessageId, draftIdentity.id)
  assert.equal(durableCalls.length, 3, 'a durable accepted identity must not call Graph again')

  const reconciliationLedger: MicrosoftGraphDispatchLedger = {
    claim: async () => ({
      action: 'reconciliation_required',
      dispatchId: 'dispatch-reconcile',
      dispatchToken: null,
      state: 'acceptance_unknown',
      graphMessageId: draftIdentity.id,
      internetMessageId: draftIdentity.internetMessageId,
    }),
    recordDraft: async () => undefined,
    finalize: async () => undefined,
  }
  let reconciliationError: unknown
  try {
    await sendTransactionalEmailWithMicrosoftGraphIdempotently(idempotentInput, {
      env,
      fetchImpl: successfulFetch([]),
      ledger: reconciliationLedger,
    })
  } catch (error) {
    reconciliationError = error
  }
  assert.deepEqual(getMicrosoftGraphFailureDisposition(reconciliationError), {
    message: 'Microsoft Graph dispatch dispatch-reconcile requires Sent Items reconciliation before another attempt.',
    acceptance: 'unknown',
    phase: 'dispatch',
    safeToFallback: false,
    dispatchId: 'dispatch-reconcile',
    correlationId: claimedIdentities[0].correlationId,
    graphMessageId: draftIdentity.id,
    internetMessageId: draftIdentity.internetMessageId,
  })

  const recordFailureCalls: Array<{ url: string; init?: RequestInit }> = []
  let recordFailure: unknown
  try {
    await sendTransactionalEmailWithMicrosoftGraph(
      {
        to: 'admin@example.test',
        subject: 'Draft persistence failure',
        html: '<p>Do not send.</p>',
        replyTo: 'acquisitions@vestblock.io',
      },
      {
        env,
        fetchImpl: successfulFetch(recordFailureCalls),
        recordDraft: async () => { throw new Error('ledger unavailable') },
      }
    )
  } catch (error) {
    recordFailure = error
  }
  assert.equal(recordFailureCalls.length, 2, 'a draft must not send when its provider identity is not durable')
  assert.deepEqual(getMicrosoftGraphFailureDisposition(recordFailure), {
    message: 'Microsoft Graph draft was created but its identity could not be persisted; the message was not sent.',
    acceptance: 'not_accepted',
    phase: 'dispatch',
    safeToFallback: false,
    graphMessageId: draftIdentity.id,
    internetMessageId: draftIdentity.internetMessageId,
  })

  const ambiguousOutcomes: OutlookTransactionalDispatchOutcome[] = []
  const ambiguousLedger: MicrosoftGraphDispatchLedger = {
    claim: async () => ({
      action: 'send',
      dispatchId: 'dispatch-ambiguous',
      dispatchToken: 'token-ambiguous',
      state: 'dispatching',
    }),
    recordDraft: async () => undefined,
    finalize: async (input) => ambiguousOutcomes.push(input.outcome),
  }
  const ambiguousFetch = (async (input: URL | RequestInfo) => {
    const url = String(input)
    if (url.includes('/oauth2/v2.0/token')) {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.endsWith('/messages')) {
      return new Response(JSON.stringify(draftIdentity), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw new Error('network ended during draft send')
  }) as typeof fetch
  let ambiguousError: unknown
  try {
    await sendTransactionalEmailWithMicrosoftGraphIdempotently(idempotentInput, {
      env,
      fetchImpl: ambiguousFetch,
      ledger: ambiguousLedger,
    })
  } catch (error) {
    ambiguousError = error
  }
  const ambiguous = getMicrosoftGraphFailureDisposition(ambiguousError)
  assert.equal(ambiguous.acceptance, 'unknown')
  assert.equal(ambiguous.safeToFallback, false)
  assert.equal(ambiguous.dispatchId, 'dispatch-ambiguous')
  assert.equal(ambiguous.graphMessageId, draftIdentity.id)
  assert.deepEqual(ambiguousOutcomes, ['acceptance_unknown'])

  const draftRejectedFetch = (async (input: URL | RequestInfo) => {
    if (String(input).includes('/oauth2/v2.0/token')) {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ error: { message: 'rejected' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  let draftRejected: unknown
  try {
    await sendTransactionalEmailWithMicrosoftGraph(
      {
        to: 'admin@example.test',
        subject: 'Rejected draft',
        html: '<p>Ready.</p>',
        replyTo: 'acquisitions@vestblock.io',
      },
      { env, fetchImpl: draftRejectedFetch }
    )
  } catch (error) {
    draftRejected = error
  }
  assert.deepEqual(getMicrosoftGraphFailureDisposition(draftRejected), {
    message: 'Microsoft Graph draft creation failed with 400.',
    acceptance: 'not_accepted',
    phase: 'pre_dispatch',
    safeToFallback: true,
  })

  const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')
  const graphSource = source('lib/email/microsoftGraphSend.ts')
  const sendEmailSource = source('lib/email/sendEmail.ts')
  const migrationSource = source('supabase/migrations/20260915215948_create_transactional_email_dispatch_ledger.sql')
  assert.match(graphSource, /\/messages`/)
  assert.match(graphSource, /messages\/\$\{encodeURIComponent\(graphMessageId\)\}\/send/)
  assert.match(graphSource, /recordDraft/)
  assert.doesNotMatch(graphSource, /\/sendMail/)
  assert.match(sendEmailSource, /const preferOutlook = prefersMicrosoftGraphTransactionalEmail/)
  assert.match(sendEmailSource, /crossProviderFallbackAllowed:\s*false/)
  assert.doesNotMatch(sendEmailSource, /if \(outlookFailure\.safeToFallback/)
  assert.match(migrationSource, /record_outlook_transactional_draft/)
  assert.match(migrationSource, /internet_message_id/)
  assert.match(
    migrationSource,
    /p_outcome NOT IN \('accepted', 'acceptance_unknown', 'failed_pre_dispatch', 'failed_dispatch'\) OR\s+\(p_error_hash/
  )
  assert.doesNotMatch(
    migrationSource,
    /p_outcome NOT IN \([\s\S]*?\)\s*\) OR\s+\(p_error_hash/,
    'the finalization guard must not contain an unmatched extra closing parenthesis'
  )
  const operatorReconciliation = migrationSource.match(
    /CREATE OR REPLACE FUNCTION public\.reconcile_outlook_transactional_dispatch[\s\S]*?(?=CREATE OR REPLACE FUNCTION public\.reconcile_outlook_dispatch_from_inbound)/
  )?.[0] || ''
  assert.match(operatorReconciliation, /state IN \('acceptance_unknown', 'failed_dispatch'\)/)
  assert.doesNotMatch(
    operatorReconciliation,
    /state IN \('dispatching'/,
    'operator not_sent reconciliation must never steal an actively owned dispatch'
  )
  const inboundReconciliation = migrationSource.match(
    /CREATE OR REPLACE FUNCTION public\.reconcile_outlook_dispatch_from_inbound[\s\S]*?(?=REVOKE ALL ON FUNCTION)/
  )?.[0] || ''
  assert.match(inboundReconciliation, /internet_message_id = btrim\(p_internet_message_id\)/)
  assert.match(inboundReconciliation, /state IN \('dispatching', 'acceptance_unknown', 'failed_dispatch'\)/)

  console.log('Microsoft Graph draft, durable identity, no-fallback, and reconciliation tests passed.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
