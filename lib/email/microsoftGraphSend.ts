import {
  buildOutlookTransactionalDispatchIdentity,
  type OutlookTransactionalDispatchClaim,
  type OutlookTransactionalDispatchIdentity,
  type OutlookTransactionalDispatchOutcome,
  type OutlookDispatchFileAttachment,
} from '@/lib/email/transactionalEmailDispatchCore'

type MicrosoftGraphEnvironment = Readonly<Record<string, string | undefined>>

type MicrosoftGraphSendInput = {
  to: string
  subject: string
  html: string
  replyTo: string
  correlationId?: string
  attachments?: readonly OutlookDispatchFileAttachment[] | null
}

type MicrosoftGraphSendDependencies = {
  env?: MicrosoftGraphEnvironment
  fetchImpl?: typeof fetch
  recordDraft?: (input: {
    graphMessageId: string
    internetMessageId: string
  }) => Promise<unknown>
}

export type MicrosoftGraphDispatchLedger = {
  claim: (
    identity: OutlookTransactionalDispatchIdentity
  ) => Promise<OutlookTransactionalDispatchClaim>
  recordDraft: (input: {
    dispatchId: string
    dispatchToken: string
    graphMessageId: string
    internetMessageId: string
  }) => Promise<unknown>
  finalize: (input: {
    dispatchId: string
    dispatchToken: string
    outcome: OutlookTransactionalDispatchOutcome
    errorMessage?: string | null
  }) => Promise<unknown>
}

type IdempotentMicrosoftGraphSendInput = MicrosoftGraphSendInput & {
  eventType: string
  idempotencyKey?: string | null
}

type IdempotentMicrosoftGraphSendDependencies = MicrosoftGraphSendDependencies & {
  ledger: MicrosoftGraphDispatchLedger
}

export type MicrosoftGraphAcceptanceState = 'not_accepted' | 'unknown'
export type MicrosoftGraphFailurePhase = 'pre_dispatch' | 'dispatch'

export class MicrosoftGraphSendError extends Error {
  readonly acceptance: MicrosoftGraphAcceptanceState
  readonly phase: MicrosoftGraphFailurePhase
  readonly safeToFallback: boolean
  readonly dispatchId: string | null
  readonly correlationId: string | null
  readonly graphMessageId: string | null
  readonly internetMessageId: string | null

  constructor(
    message: string,
    details: {
      acceptance: MicrosoftGraphAcceptanceState
      phase: MicrosoftGraphFailurePhase
      safeToFallback?: boolean
      dispatchId?: string | null
      correlationId?: string | null
      graphMessageId?: string | null
      internetMessageId?: string | null
    }
  ) {
    super(message)
    this.name = 'MicrosoftGraphSendError'
    this.acceptance = details.acceptance
    this.phase = details.phase
    this.safeToFallback = details.safeToFallback ?? (
      details.phase === 'pre_dispatch' && details.acceptance === 'not_accepted'
    )
    this.dispatchId = details.dispatchId || null
    this.correlationId = details.correlationId || null
    this.graphMessageId = details.graphMessageId || null
    this.internetMessageId = details.internetMessageId || null
  }
}

export type MicrosoftGraphFailureDisposition = {
  message: string
  acceptance: MicrosoftGraphAcceptanceState
  phase: MicrosoftGraphFailurePhase
  safeToFallback: boolean
  dispatchId?: string | null
  correlationId?: string | null
  graphMessageId?: string | null
  internetMessageId?: string | null
}

const MICROSOFT_GRAPH_TIMEOUT_MS = 20_000
const MICROSOFT_GRAPH_MAX_ATTACHMENT_COUNT = 3
const MICROSOFT_GRAPH_MAX_TOTAL_ATTACHMENT_BYTES = 2_500_000

function validatedAttachments(value: readonly OutlookDispatchFileAttachment[] | null | undefined) {
  const attachments = value || []
  if (attachments.length > MICROSOFT_GRAPH_MAX_ATTACHMENT_COUNT) {
    throw graphFailure(
      `Microsoft Graph supports at most ${MICROSOFT_GRAPH_MAX_ATTACHMENT_COUNT} attachments per VestBlock message.`,
      { acceptance: 'not_accepted', phase: 'pre_dispatch' }
    )
  }
  let totalBytes = 0
  const normalized = attachments.map((attachment) => {
    const filename = String(attachment.filename || '').trim()
    const contentType = String(attachment.contentType || '').trim().toLowerCase()
    const contentBase64 = String(attachment.contentBase64 || '').replace(/\s+/g, '')
    if (
      !filename ||
      filename.length > 180 ||
      !/^[A-Za-z0-9_.() -]+$/.test(filename) ||
      !/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(contentType) ||
      !contentBase64 ||
      contentBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)
    ) {
      throw graphFailure(
        'Microsoft Graph attachment payload is invalid.',
        { acceptance: 'not_accepted', phase: 'pre_dispatch' }
      )
    }
    const padding = contentBase64.endsWith('==') ? 2 : contentBase64.endsWith('=') ? 1 : 0
    totalBytes += (contentBase64.length * 3) / 4 - padding
    return { filename, contentType, contentBase64 }
  })
  if (totalBytes > MICROSOFT_GRAPH_MAX_TOTAL_ATTACHMENT_BYTES) {
    throw graphFailure(
      `Microsoft Graph attachment payload exceeds ${MICROSOFT_GRAPH_MAX_TOTAL_ATTACHMENT_BYTES} bytes.`,
      { acceptance: 'not_accepted', phase: 'pre_dispatch' }
    )
  }
  return normalized
}

function graphFailure(
  message: string,
  details: {
    acceptance: MicrosoftGraphAcceptanceState
    phase: MicrosoftGraphFailurePhase
    safeToFallback?: boolean
    dispatchId?: string | null
    correlationId?: string | null
    graphMessageId?: string | null
    internetMessageId?: string | null
  }
) {
  return new MicrosoftGraphSendError(message, details)
}

/**
 * Unknown errors are treated as dispatch-ambiguous. This is deliberately
 * conservative: a second provider must never be tried unless Graph is known
 * not to have received the message.
 */
export function getMicrosoftGraphFailureDisposition(
  error: unknown
): MicrosoftGraphFailureDisposition {
  if (error instanceof MicrosoftGraphSendError) {
    return {
      message: error.message,
      acceptance: error.acceptance,
      phase: error.phase,
      safeToFallback: error.safeToFallback,
      ...(error.dispatchId ? { dispatchId: error.dispatchId } : {}),
      ...(error.correlationId ? { correlationId: error.correlationId } : {}),
      ...(error.graphMessageId ? { graphMessageId: error.graphMessageId } : {}),
      ...(error.internetMessageId ? { internetMessageId: error.internetMessageId } : {}),
    }
  }

  return {
    message: error instanceof Error ? error.message : 'Microsoft Graph send failed.',
    acceptance: 'unknown',
    phase: 'dispatch',
    safeToFallback: false,
  }
}

function value(env: MicrosoftGraphEnvironment, name: string) {
  return String(env[name] || '').trim()
}

function applicationConfig(env: MicrosoftGraphEnvironment) {
  return {
    clientId: value(env, 'MICROSOFT_GRAPH_CLIENT_ID'),
    clientSecret: value(env, 'MICROSOFT_GRAPH_CLIENT_SECRET'),
    tenantId: value(env, 'MICROSOFT_TENANT_ID'),
    mailbox: value(env, 'OUTLOOK_ACQUISITIONS_MAILBOX'),
  }
}

export function hasMicrosoftGraphApplicationCredentials(
  env: MicrosoftGraphEnvironment = process.env
) {
  const config = applicationConfig(env)
  return Boolean(
    config.clientId &&
      config.clientSecret &&
      config.tenantId &&
      config.mailbox
  )
}

export function prefersMicrosoftGraphTransactionalEmail(
  providerPreference?: 'resend' | 'google' | 'outlook',
  env: MicrosoftGraphEnvironment = process.env
) {
  // Outlook is authoritative even when the provider variable is absent or
  // mistyped. Dormant Gmail/Resend code is reachable only in an explicitly
  // opted-in local test/development process, never in production.
  const runtime = value(env, 'NODE_ENV').toLowerCase()
  const vercelEnvironment = value(env, 'VERCEL_ENV').toLowerCase()
  const legacyOverride =
    vercelEnvironment !== 'production' &&
    ['development', 'test'].includes(runtime) &&
    value(env, 'ALLOW_LEGACY_EMAIL_PROVIDER_OVERRIDE').toLowerCase() === 'true' &&
    (providerPreference === 'google' || providerPreference === 'resend')
  return !legacyOverride
}

function requireApplicationConfig(env: MicrosoftGraphEnvironment) {
  const config = applicationConfig(env)
  const missing = [
    !config.clientId ? 'MICROSOFT_GRAPH_CLIENT_ID' : null,
    !config.clientSecret ? 'MICROSOFT_GRAPH_CLIENT_SECRET' : null,
    !config.tenantId ? 'MICROSOFT_TENANT_ID' : null,
    !config.mailbox ? 'OUTLOOK_ACQUISITIONS_MAILBOX' : null,
  ].filter((name): name is string => Boolean(name))

  if (missing.length > 0) {
    throw graphFailure(
      `Microsoft Graph application configuration is incomplete: ${missing.join(', ')}.`,
      { acceptance: 'not_accepted', phase: 'pre_dispatch' }
    )
  }

  return config
}

function recipients(to: string) {
  return to
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address } }))
}

async function requestMicrosoftGraphToken(
  config: ReturnType<typeof requireApplicationConfig>,
  fetchImpl: typeof fetch
) {
  let response: Response
  try {
    response = await fetchImpl(
      `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'client_credentials',
          scope: 'https://graph.microsoft.com/.default',
        }),
        signal: AbortSignal.timeout(MICROSOFT_GRAPH_TIMEOUT_MS),
      }
    )
  } catch {
    throw graphFailure(
      'Microsoft Graph token request failed before a response was received.',
      { acceptance: 'not_accepted', phase: 'pre_dispatch' }
    )
  }

  const data = await response.json().catch(() => ({})) as { access_token?: unknown }
  if (!response.ok || typeof data.access_token !== 'string' || !data.access_token) {
    throw graphFailure(
      `Microsoft Graph token request failed with ${response.status}.`,
      { acceptance: 'not_accepted', phase: 'pre_dispatch' }
    )
  }

  return data.access_token
}

export async function sendTransactionalEmailWithMicrosoftGraph(
  input: MicrosoftGraphSendInput,
  dependencies: MicrosoftGraphSendDependencies = {}
) {
  const env = dependencies.env || process.env
  const fetchImpl = dependencies.fetchImpl || fetch
  const config = requireApplicationConfig(env)
  const toRecipients = recipients(input.to)
  const attachments = validatedAttachments(input.attachments)

  if (toRecipients.length === 0) {
    throw graphFailure(
      'Microsoft Graph transactional email requires at least one recipient.',
      { acceptance: 'not_accepted', phase: 'pre_dispatch' }
    )
  }

  const accessToken = await requestMicrosoftGraphToken(config, fetchImpl)

  let draftResponse: Response
  try {
    draftResponse = await fetchImpl(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.mailbox)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: input.subject,
          body: {
            contentType: 'HTML',
            content: input.html,
          },
          from: {
            emailAddress: {
              address: config.mailbox,
            },
          },
          toRecipients,
          replyTo: [{ emailAddress: { address: input.replyTo } }],
          internetMessageHeaders: input.correlationId
            ? [
                {
                  name: 'X-VestBlock-Correlation-ID',
                  value: input.correlationId,
                },
              ]
            : undefined,
          attachments: attachments.length
            ? attachments.map((attachment) => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: attachment.filename,
                contentType: attachment.contentType,
                contentBytes: attachment.contentBase64,
              }))
            : undefined,
        }),
        signal: AbortSignal.timeout(MICROSOFT_GRAPH_TIMEOUT_MS),
      }
    )
  } catch {
    throw graphFailure(
      'Microsoft Graph draft creation ended without a response; no send attempt was made.',
      { acceptance: 'not_accepted', phase: 'pre_dispatch' }
    )
  }

  const draft = await draftResponse.json().catch(() => ({})) as {
    id?: unknown
    internetMessageId?: unknown
  }
  const graphMessageId = typeof draft.id === 'string' ? draft.id.trim() : ''
  const internetMessageId = typeof draft.internetMessageId === 'string'
    ? draft.internetMessageId.trim()
    : ''
  if (draftResponse.status !== 201 || !graphMessageId || !internetMessageId) {
    throw graphFailure(
      `Microsoft Graph draft creation failed with ${draftResponse.status}.`,
      { acceptance: 'not_accepted', phase: 'pre_dispatch' }
    )
  }

  if (dependencies.recordDraft) {
    try {
      await dependencies.recordDraft({ graphMessageId, internetMessageId })
    } catch {
      throw graphFailure(
        'Microsoft Graph draft was created but its identity could not be persisted; the message was not sent.',
        {
          acceptance: 'not_accepted',
          phase: 'dispatch',
          safeToFallback: false,
          graphMessageId,
          internetMessageId,
        }
      )
    }
  }

  let sendResponse: Response
  try {
    sendResponse = await fetchImpl(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.mailbox)}/messages/${encodeURIComponent(graphMessageId)}/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(MICROSOFT_GRAPH_TIMEOUT_MS),
      }
    )
  } catch {
    throw graphFailure(
      'Microsoft Graph draft send ended without a response; provider acceptance is unknown.',
      {
        acceptance: 'unknown',
        phase: 'dispatch',
        graphMessageId,
        internetMessageId,
      }
    )
  }

  if (sendResponse.status !== 202) {
    throw graphFailure(
      `Microsoft Graph draft send failed with ${sendResponse.status}.`,
      {
        acceptance: 'not_accepted',
        phase: 'dispatch',
        safeToFallback: false,
        graphMessageId,
        internetMessageId,
      }
    )
  }

  return {
    accepted: true as const,
    acceptance: 'accepted' as const,
    providerMessageId: graphMessageId,
    graphMessageId,
    internetMessageId,
  }
}

function ledgerOutcomeForFailure(
  disposition: MicrosoftGraphFailureDisposition
): OutlookTransactionalDispatchOutcome {
  if (disposition.phase === 'pre_dispatch' && disposition.acceptance === 'not_accepted') {
    return 'failed_pre_dispatch'
  }
  if (disposition.acceptance === 'unknown') return 'acceptance_unknown'
  return 'failed_dispatch'
}

/**
 * Wraps the raw Graph call in a durable dispatch claim. The claim is recorded
 * before any provider request. Therefore, a process crash after a 202 leaves a
 * reconciliation-required record instead of reopening the message for retry.
 */
export async function sendTransactionalEmailWithMicrosoftGraphIdempotently(
  input: IdempotentMicrosoftGraphSendInput,
  dependencies: IdempotentMicrosoftGraphSendDependencies
) {
  let attachments: ReturnType<typeof validatedAttachments>
  try {
    attachments = validatedAttachments(input.attachments)
  } catch (error) {
    throw error
  }
  let identity: OutlookTransactionalDispatchIdentity
  try {
    identity = buildOutlookTransactionalDispatchIdentity({ ...input, attachments })
  } catch (error) {
    throw graphFailure(
      error instanceof Error ? error.message : 'Microsoft Graph dispatch identity is invalid.',
      { acceptance: 'not_accepted', phase: 'pre_dispatch', safeToFallback: false }
    )
  }

  let claim: OutlookTransactionalDispatchClaim
  try {
    claim = await dependencies.ledger.claim(identity)
  } catch {
    throw graphFailure(
      'Microsoft Graph dispatch was blocked because the durable idempotency ledger is unavailable.',
      {
        acceptance: 'not_accepted',
        phase: 'pre_dispatch',
        correlationId: identity.correlationId,
      }
    )
  }

  if (claim.action === 'deduplicated_accepted') {
    return {
      accepted: true as const,
      acceptance: 'accepted' as const,
      deduplicated: true as const,
      ledgerFinalized: true,
      dispatchId: claim.dispatchId,
      providerMessageId: claim.graphMessageId || null,
      graphMessageId: claim.graphMessageId || null,
      internetMessageId: claim.internetMessageId || null,
      correlationId: identity.correlationId,
      effectiveIdempotencyKey: identity.effectiveIdempotencyKey,
    }
  }

  if (claim.action === 'reconciliation_required') {
    throw graphFailure(
      `Microsoft Graph dispatch ${claim.dispatchId} requires Sent Items reconciliation before another attempt.`,
      {
        acceptance: 'unknown',
        phase: 'dispatch',
        safeToFallback: false,
        dispatchId: claim.dispatchId,
        correlationId: identity.correlationId,
        graphMessageId: claim.graphMessageId,
        internetMessageId: claim.internetMessageId,
      }
    )
  }

  if (claim.action === 'identity_conflict') {
    throw graphFailure(
      'Microsoft Graph idempotency key was reused with a different message identity.',
      {
        acceptance: 'not_accepted',
        phase: 'pre_dispatch',
        safeToFallback: false,
        dispatchId: claim.dispatchId,
        correlationId: identity.correlationId,
        graphMessageId: claim.graphMessageId,
        internetMessageId: claim.internetMessageId,
      }
    )
  }

  try {
    const result = await sendTransactionalEmailWithMicrosoftGraph(
      {
        to: input.to,
        subject: input.subject,
        html: input.html,
        replyTo: input.replyTo,
        correlationId: identity.correlationId,
        attachments,
      },
      {
        ...dependencies,
        recordDraft: (draft) => dependencies.ledger.recordDraft({
          dispatchId: claim.dispatchId,
          dispatchToken: claim.dispatchToken,
          ...draft,
        }),
      }
    )
    const ledgerFinalized = await dependencies.ledger.finalize({
      dispatchId: claim.dispatchId,
      dispatchToken: claim.dispatchToken,
      outcome: 'accepted',
    }).then(
      () => true,
      () => false
    )

    return {
      ...result,
      deduplicated: false as const,
      ledgerFinalized,
      dispatchId: claim.dispatchId,
      correlationId: identity.correlationId,
      providerMessageId: result.providerMessageId,
      graphMessageId: result.graphMessageId,
      internetMessageId: result.internetMessageId,
      effectiveIdempotencyKey: identity.effectiveIdempotencyKey,
    }
  } catch (error) {
    const disposition = getMicrosoftGraphFailureDisposition(error)
    await dependencies.ledger.finalize({
      dispatchId: claim.dispatchId,
      dispatchToken: claim.dispatchToken,
      outcome: ledgerOutcomeForFailure(disposition),
      errorMessage: disposition.message,
    }).catch(() => null)
    throw graphFailure(disposition.message, {
      acceptance: disposition.acceptance,
      phase: disposition.phase,
      safeToFallback: disposition.safeToFallback,
      dispatchId: claim.dispatchId,
      correlationId: identity.correlationId,
      graphMessageId: disposition.graphMessageId,
      internetMessageId: disposition.internetMessageId,
    })
  }
}
