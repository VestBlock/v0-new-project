import { createHash } from 'node:crypto'

import type { OperatingStrategyBinding } from '@/lib/strategy/runtime-governance'

const IDENTIFIER_LIMIT = 1024
const BODY_LIMIT = 10_000
const GATE3D1_BUSINESS_WINDOW = Object.freeze({
  startMinute: 10 * 60 + 30,
  endMinute: 16 * 60 + 30,
})

type GraphAuthMode = 'application_credentials'

export type Gate3d1GraphReplyTarget = Readonly<{
  mailboxObjectId: string
  mailboxAddress: string
  inboundImmutableMessageId: string
  conversationId: string
  inboundInternetMessageId: string
}>

export type Gate3d1GraphReplyRequest = Readonly<{
  leadId: string
  replyMemoryId: string
  outreachMessageId: string
  recipientEmail: string
  recipientTimeZone: string
  propertyAddress: string
  sourceNamespace: 'operating_strategy'
  sourceIdentifier: string
  operatingStrategyVersionId: string
  outreachPurpose: string
  messageVersionKey: string
  authorizationId: string
  exchangeRbacAttestationId: string
  approvalManifestKey: string
  contentFingerprint: string
  threadFingerprint: string
  contractFingerprint: string
  reservationIdempotencyKey: string
  idempotencyKey: string
  comment: string
  target: Gate3d1GraphReplyTarget
}>

export type Gate3d1GraphThreadEvidence = Readonly<{
  mailboxObjectId: string
  mailboxAddress: string
  recipientEmail: string
  targetInboundImmutableMessageId: string
  targetConversationId: string
  targetInternetMessageId: string
  outboundImmutableMessageId: string
  outboundInternetMessageId: string
}>

export type GraphMessageIdentity = Readonly<{
  id: string
  conversationId: string
  internetMessageId: string
  fromAddress: string
  toAddresses: readonly string[]
  ccAddresses?: readonly string[]
  bccAddresses?: readonly string[]
  isDraft?: boolean
  sentDateTime?: string | null
}>

export type GraphReplyCallbackIdentity = Readonly<{
  mailboxObjectId: string
  mailboxAddress: string
  immutableMessageId: string
  conversationId: string
  internetMessageId: string
  fromAddress: string
  toAddresses: readonly string[]
  internetMessageHeaders: readonly Readonly<{ name: string; value: string }>[]
}>

export type Gate3d1GraphPermissionReadiness = Readonly<{
  ready: boolean
  authMode: GraphAuthMode
  grantedPermissions: readonly string[]
  missingPermissions: readonly string[]
}>

export type Gate3d1GraphSession = Readonly<{
  accessToken: string
  authMode: GraphAuthMode
  grantedPermissions: readonly string[]
  tenantId?: string | null
  clientId?: string | null
  scopedPermissionAttestation?: Readonly<{
    attestationId: string
    tenantId: string
    clientId: string
    mailboxObjectId: string
    mailboxAddress: string
    roleNames: readonly string[]
    outOfScopeMailboxObjectId: string
    founderReviewerUserId: string
    verifiedAt: string
    expiresAt: string
    inScopeProofFingerprint: string
    outOfScopeDenyProofFingerprint: string
    attestationFingerprint: string
  }> | null
}>

export type Gate3d1CanaryPreflight = Readonly<{
  suppressionSnapshot: Readonly<Record<string, unknown>>
  market: string | null
  propertyAddress: string | null
}>

export type Gate3d1PersistedIntent = Readonly<{
  enrollmentId: string
  canonicalActivityId: string
  dispatchIntentAt?: string
  existingThread?: Gate3d1GraphThreadEvidence | null
}>

export type Gate3d1DispatchIntent = Gate3d1PersistedIntent & Readonly<{
  claimId: string
  state:
    | 'intent_confirmed'
    | 'draft_attempted'
    | 'draft_created'
    | 'send_attempted'
    | 'accepted'
    | 'ambiguous'
    | 'reconciled_accepted'
    | 'reconciled_not_sent'
    | 'dead_lettered'
}>

export type Gate3d1DispatchClaim = Readonly<{
  claimId: string
  authorizationId: string
  exchangeRbacAttestationId: string
  expiresAt: string
  claimFingerprint: string
  consentBasisSnapshot: Readonly<Record<string, unknown>>
}>

export type Gate3d1DispatchReservation = Readonly<{
  reservationId: string
}>

export type Gate3d1GraphReplyDependencies = Readonly<{
  now: () => Date
  assertActivation: (request: Gate3d1GraphReplyRequest) => Promise<void> | void
  getGraphSession: (
    request: Gate3d1GraphReplyRequest,
    claim: Gate3d1DispatchClaim
  ) => Promise<Gate3d1GraphSession>
  authorize: (request: Gate3d1GraphReplyRequest) => Promise<OperatingStrategyBinding>
  assertNoStopSignal: (
    request: Gate3d1GraphReplyRequest,
    phase: 'before_reservation' | 'before_create_reply' | 'before_send'
  ) => Promise<Gate3d1CanaryPreflight>
  claimAuthorization: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    preflight: Gate3d1CanaryPreflight
  }) => Promise<Gate3d1DispatchClaim>
  reserve: (
    request: Gate3d1GraphReplyRequest,
    binding: OperatingStrategyBinding,
    claim: Gate3d1DispatchClaim
  ) => Promise<Gate3d1DispatchReservation>
  bindReservation: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    claim: Gate3d1DispatchClaim
    reservation: Gate3d1DispatchReservation
  }) => Promise<void>
  persistIntent: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    claim: Gate3d1DispatchClaim
    reservation: Gate3d1DispatchReservation
    preflight: Gate3d1CanaryPreflight
    dispatchIntentAt: string
  }) => Promise<Gate3d1PersistedIntent>
  confirmIntent: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    claim: Gate3d1DispatchClaim
    reservation: Gate3d1DispatchReservation
    intent: Gate3d1PersistedIntent
  }) => Promise<Gate3d1DispatchIntent>
  assertProviderMutationAllowed: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    claim: Gate3d1DispatchClaim
    reservation: Gate3d1DispatchReservation
    intent: Gate3d1DispatchIntent
    mutation: 'create_reply' | 'send'
  }) => Promise<void>
  beginDraftAttempt: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    claim: Gate3d1DispatchClaim
    reservation: Gate3d1DispatchReservation
    intent: Gate3d1DispatchIntent
  }) => Promise<void>
  getTargetMessage: (
    session: Gate3d1GraphSession,
    target: Gate3d1GraphReplyTarget
  ) => Promise<GraphMessageIdentity>
  getOutboundMessage: (
    session: Gate3d1GraphSession,
    target: Gate3d1GraphReplyTarget,
    outboundImmutableMessageId: string
  ) => Promise<GraphMessageIdentity>
  createReplyDraft: (
    session: Gate3d1GraphSession,
    request: Gate3d1GraphReplyRequest
  ) => Promise<GraphMessageIdentity>
  persistDraftIdentity: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    claim: Gate3d1DispatchClaim
    reservation: Gate3d1DispatchReservation
    preflight: Gate3d1CanaryPreflight
    intent: Gate3d1DispatchIntent
    dispatchIntentAt: string
    thread: Gate3d1GraphThreadEvidence
  }) => Promise<void>
  recordDraftResult: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    claim: Gate3d1DispatchClaim
    reservation: Gate3d1DispatchReservation
    intent: Gate3d1DispatchIntent
    outcome: 'draft_created' | 'ambiguous'
    thread?: Gate3d1GraphThreadEvidence | null
    errorCode?: string | null
  }) => Promise<void>
  beginSendAttempt: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    claim: Gate3d1DispatchClaim
    reservation: Gate3d1DispatchReservation
    intent: Gate3d1DispatchIntent
    thread: Gate3d1GraphThreadEvidence
  }) => Promise<void>
  sendReplyDraft: (
    session: Gate3d1GraphSession,
    target: Gate3d1GraphReplyTarget,
    outboundImmutableMessageId: string
  ) => Promise<{ status: 202 }>
  persistAccepted: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    claim: Gate3d1DispatchClaim
    reservation: Gate3d1DispatchReservation
    preflight: Gate3d1CanaryPreflight
    intent: Gate3d1DispatchIntent
    dispatchIntentAt: string
    acceptedAt: string
    thread: Gate3d1GraphThreadEvidence
  }) => Promise<void>
  recordSendResult: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    claim: Gate3d1DispatchClaim
    reservation: Gate3d1DispatchReservation
    intent: Gate3d1DispatchIntent
    outcome: 'accepted' | 'ambiguous'
    thread: Gate3d1GraphThreadEvidence
    acceptedAt?: string | null
    errorCode?: string | null
  }) => Promise<void>
  ensureStopsEngaged: (input: {
    request: Gate3d1GraphReplyRequest
    binding: OperatingStrategyBinding
    phase: 'accepted_recovery' | 'accepted_delivery'
  }) => Promise<void>
  failClosed: (input: {
    request: Gate3d1GraphReplyRequest
    binding?: OperatingStrategyBinding | null
    claim?: Gate3d1DispatchClaim | null
    reservation?: Gate3d1DispatchReservation | null
    intent?: Gate3d1DispatchIntent | null
    thread?: Gate3d1GraphThreadEvidence | null
    failurePhase: string
  }) => Promise<void>
}>

function requireCompactIdentifier(value: string, label: string) {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${label} is required.`)
  if (normalized.length > IDENTIFIER_LIMIT || /\s/.test(normalized)) {
    throw new Error(`${label} must be a compact exact identifier.`)
  }
  return normalized
}

function requireUuid(value: string, label: string) {
  const normalized = requireCompactIdentifier(value, label)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`${label} must be an exact UUID.`)
  }
  return normalized
}

function requireEmail(value: string, label: string) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 320) {
    throw new Error(`${label} must be an exact email address.`)
  }
  return normalized
}

function requireInternetMessageId(value: string, label: string) {
  const normalized = requireCompactIdentifier(value, label)
  if (!/^<[^<>\s]+>$/.test(normalized)) {
    throw new Error(`${label} must be an exact RFC Internet Message-ID.`)
  }
  return normalized
}

function requireSha256(value: string, label: string) {
  const normalized = requireCompactIdentifier(value, label)
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`${label} must be an exact lowercase SHA-256 fingerprint.`)
  }
  return normalized
}

function requireMd5Fingerprint(value: string, label: string) {
  const normalized = requireCompactIdentifier(value, label)
  if (!/^[0-9a-f]{32}$/.test(normalized)) {
    throw new Error(`${label} must be an exact lowercase 32-character contract fingerprint.`)
  }
  return normalized
}

function requireIanaTimeZone(value: string, label: string) {
  const normalized = requireCompactIdentifier(value, label)
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date(0))
  } catch {
    throw new Error(`${label} must be an exact IANA time-zone identifier.`)
  }
  return normalized
}

function requireGateKey(value: string, label: string) {
  const normalized = requireCompactIdentifier(value, label)
  if (!/^[a-z0-9][a-z0-9_.:-]{2,127}$/.test(normalized)) {
    throw new Error(`${label} must use the exact lowercase Gate 3D.1 key format.`)
  }
  return normalized
}

function sha256Canonical(value: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function resolveGate3d1GraphApplicationClientId(input: {
  tokenVersion: string | null | undefined
  authorizedPartyClientId: string | null | undefined
  applicationClientId: string | null | undefined
  expectedClientId: string
}) {
  const tokenVersion = String(input.tokenVersion || '').trim()
  const authorizedPartyClientId = String(input.authorizedPartyClientId || '').trim()
  const applicationClientId = String(input.applicationClientId || '').trim()
  const expectedClientId = requireUuid(input.expectedClientId, 'Expected Graph application client ID')
  if (
    authorizedPartyClientId &&
    applicationClientId &&
    authorizedPartyClientId !== applicationClientId
  ) {
    throw new Error('Microsoft Graph token contains conflicting application client identities.')
  }
  const clientId = tokenVersion === '2.0'
    ? authorizedPartyClientId
    : tokenVersion === '1.0'
      ? applicationClientId
      : ''
  if (!clientId) {
    throw new Error('Microsoft Graph token version or application client identity is unsupported.')
  }
  if (clientId !== expectedClientId) {
    throw new Error('Microsoft Graph token client identity does not match the dedicated Gate 3D.1 application.')
  }
  return clientId
}

export function fingerprintGate3d1GraphReplyThread(input: {
  leadId: string
  replyMemoryId: string
  recipientEmail: string
  recipientTimeZone: string
  propertyAddress: string
  target: Gate3d1GraphReplyTarget
}) {
  return sha256Canonical({
    leadId: input.leadId,
    replyMemoryId: input.replyMemoryId,
    recipientEmail: input.recipientEmail.trim().toLowerCase(),
    recipientTimeZone: input.recipientTimeZone,
    propertyAddress: input.propertyAddress.trim(),
    mailboxObjectId: input.target.mailboxObjectId,
    mailboxAddress: input.target.mailboxAddress.trim().toLowerCase(),
    inboundImmutableMessageId: input.target.inboundImmutableMessageId,
    conversationId: input.target.conversationId,
    inboundInternetMessageId: input.target.inboundInternetMessageId,
  })
}

export function fingerprintGate3d1GraphReplyContent(input: {
  outreachMessageId: string
  sourceIdentifier: string
  outreachPurpose: string
  messageVersionKey: string
  comment: string
}) {
  return createHash('sha256').update(input.comment.trim()).digest('hex')
}

function newReplyText(bodyPreview: string | null | undefined) {
  const lines = String(bodyPreview || '').replace(/\r\n?/g, '\n').split('\n')
  const newContent: string[] = []
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^>/.test(line)) continue
    if (/^(?:on .+ wrote:|(?:from|sent|to|subject):)/i.test(line)) break
    newContent.push(line)
  }
  return newContent.join(' ').replace(/\s+/g, ' ').trim()
}

export function isExplicitEmailOptOutText(input: {
  subject?: string | null
  bodyPreview?: string | null
}) {
  const subject = String(input.subject || '').replace(/\s+/g, ' ').trim()
  const replyText = newReplyText(input.bodyPreview)
  const normalizeCommand = (value: string) => value
    .replace(/^(?:re|fw|fwd):\s*/i, '')
    .replace(/[.!?,;:]+$/g, '')
    .trim()
    .toLowerCase()
  const standaloneCommands = new Set(['stop', 'end', 'cancel', 'unsubscribe', 'quit'])
  if (
    standaloneCommands.has(normalizeCommand(replyText)) ||
    standaloneCommands.has(normalizeCommand(subject))
  ) {
    return true
  }
  return /\b(?:unsubscribe|do not contact|don't contact|please stop|stop (?:emailing|contacting|sending (?:me )?(?:emails?|messages?))|no more emails?|take me off (?:your|the) list|opt[ -]?out|remove me)\b/i
    .test(replyText)
}

export function isConservativePositiveSellerReplyText(input: {
  subject?: string | null
  bodyPreview?: string | null
}) {
  const replyText = newReplyText(input.bodyPreview).toLowerCase()
  if (!replyText || isExplicitEmailOptOutText(input)) return false
  if (
    /\b(?:no thanks?|not interested|wrong (?:person|number)|do not|don't|never contact|already sold|not selling|won't sell|will not sell|leave me alone)\b/.test(replyText)
  ) {
    return false
  }
  return /\b(?:yes|interested|tell me more|let(?:'s| us) talk|call me|text me|open to|consider(?:ing)?|willing|selling|sell|offer|asking price|property|house|address|timeline|close|closing)\b/.test(replyText)
}

export function selectExactGate3d1LocalDraft<Row extends {
  lead_id?: unknown
  channel?: unknown
  generated_with?: unknown
  variant_key?: unknown
}>(
  rows: readonly Row[],
  identity: {
    leadId: string
    generator: string
    messageVersionKey: string
  }
) {
  const matches = rows.filter((row) =>
    String(row.lead_id || '') === identity.leadId &&
    String(row.channel || '') === 'email' &&
    String(row.generated_with || '') === identity.generator &&
    String(row.variant_key || '') === identity.messageVersionKey
  )
  if (matches.length > 1) {
    throw new Error('Gate 3D.1 found ambiguous exact local drafts for the same message version.')
  }
  return matches[0] || null
}

export function hasExactGate3d1ReplyMemoryProvenance(
  metadata: unknown,
  expected: {
    tenantId: string
    mailboxObjectId: string
  }
) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const row = metadata as Record<string, unknown>
  const observedTenantId = String(row.observedTenantId || '')
  const observedMailboxObjectId = String(row.observedMailboxObjectId || '')
  const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  return (
    canonicalUuid.test(observedTenantId) &&
    canonicalUuid.test(observedMailboxObjectId) &&
    observedTenantId === expected.tenantId &&
    observedMailboxObjectId === expected.mailboxObjectId
  )
}

export async function resolveGate3d1ExecutionOrStop<T>(input: {
  resolve: () => Promise<T>
  engageStops: (resolutionError: unknown) => Promise<void>
}) {
  try {
    return await input.resolve()
  } catch (resolutionError) {
    try {
      await input.engageStops(resolutionError)
    } catch (stopError) {
      throw new Error(
        `Gate 3D.1 manifest resolution failed and both stops could not be confirmed: ${stopError instanceof Error ? stopError.message : 'unknown stop error'}.`,
        { cause: resolutionError }
      )
    }
    throw resolutionError
  }
}

export function normalizeGate3d1GraphReplyRequest(
  input: Gate3d1GraphReplyRequest
): Gate3d1GraphReplyRequest {
  if (input.sourceNamespace !== 'operating_strategy') {
    throw new Error('Gate 3D.1 is restricted to the operating_strategy namespace.')
  }
  const sourceIdentifier = requireCompactIdentifier(input.sourceIdentifier, 'Strategy source identifier')
  if (sourceIdentifier !== 'seller_options_intake') {
    throw new Error('Gate 3D.1 is restricted to the seller_options_intake operating strategy.')
  }
  if (input.outreachPurpose !== 'seller_reply_followup') {
    throw new Error('Gate 3D.1 is restricted to the seller_reply_followup purpose.')
  }
  const comment = String(input.comment || '').trim()
  if (!comment || comment.length > BODY_LIMIT) {
    throw new Error(`Graph reply comment must contain between 1 and ${BODY_LIMIT} characters.`)
  }

  const target = Object.freeze({
    mailboxObjectId: requireUuid(input.target.mailboxObjectId, 'Graph mailbox object ID'),
    mailboxAddress: requireEmail(input.target.mailboxAddress, 'Graph mailbox address'),
    inboundImmutableMessageId: requireCompactIdentifier(
      input.target.inboundImmutableMessageId,
      'Inbound immutable Graph message ID'
    ),
    conversationId: requireCompactIdentifier(input.target.conversationId, 'Graph conversation ID'),
    inboundInternetMessageId: requireInternetMessageId(
      input.target.inboundInternetMessageId,
      'Inbound Internet Message-ID'
    ),
  })

  const normalized = Object.freeze({
    leadId: requireUuid(input.leadId, 'Lead ID'),
    replyMemoryId: requireUuid(input.replyMemoryId, 'Reply-memory ID'),
    outreachMessageId: requireUuid(input.outreachMessageId, 'Outreach message ID'),
    recipientEmail: requireEmail(input.recipientEmail, 'Canary recipient'),
    recipientTimeZone: requireIanaTimeZone(input.recipientTimeZone, 'Recipient time zone'),
    propertyAddress: String(input.propertyAddress || '').replace(/\s+/g, ' ').trim(),
    sourceNamespace: 'operating_strategy',
    sourceIdentifier,
    operatingStrategyVersionId: requireUuid(
      input.operatingStrategyVersionId,
      'Operating strategy version ID'
    ),
    outreachPurpose: requireCompactIdentifier(input.outreachPurpose, 'Outreach purpose'),
    messageVersionKey: requireGateKey(input.messageVersionKey, 'Message version key'),
    authorizationId: requireUuid(input.authorizationId, 'Inbound continuation authorization ID'),
    exchangeRbacAttestationId: requireUuid(
      input.exchangeRbacAttestationId,
      'Exchange Application RBAC attestation ID'
    ),
    approvalManifestKey: requireCompactIdentifier(input.approvalManifestKey, 'Approval manifest key'),
    contentFingerprint: requireSha256(input.contentFingerprint, 'Reply content fingerprint'),
    threadFingerprint: requireSha256(input.threadFingerprint, 'Reply thread fingerprint'),
    contractFingerprint: requireMd5Fingerprint(input.contractFingerprint, 'Operating contract fingerprint'),
    reservationIdempotencyKey: requireGateKey(
      input.reservationIdempotencyKey,
      'Reservation idempotency key'
    ),
    idempotencyKey: requireGateKey(input.idempotencyKey, 'Canary idempotency key'),
    comment,
    target,
  })
  if (normalized.propertyAddress.length < 5 || normalized.propertyAddress.length > 300) {
    throw new Error('Gate 3D.1 requires the exact approved property address.')
  }
  if (fingerprintGate3d1GraphReplyThread(normalized) !== normalized.threadFingerprint) {
    throw new Error('Reply thread fingerprint does not match the exact immutable Graph target.')
  }
  if (fingerprintGate3d1GraphReplyContent(normalized) !== normalized.contentFingerprint) {
    throw new Error('Reply content fingerprint does not match the exact approved authored comment.')
  }
  return normalized
}

export function assertGate3d1BusinessWindow(now: Date, recipientTimeZone: string) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error('A valid canary dispatch time is required.')
  }
  const timeZone = requireIanaTimeZone(recipientTimeZone, 'Recipient time zone')
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value])
  )
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun') {
    throw new Error(`Gate 3D.1 canary dispatch is blocked on weekends in ${timeZone}.`)
  }
  const localMinute = Number(parts.hour) * 60 + Number(parts.minute)
  if (
    !Number.isInteger(localMinute) ||
    localMinute < GATE3D1_BUSINESS_WINDOW.startMinute ||
    localMinute >= GATE3D1_BUSINESS_WINDOW.endMinute
  ) {
    throw new Error(`Gate 3D.1 canary dispatch is allowed only from 10:30 through 16:29 ${timeZone}.`)
  }
}

export function assertGate3d1DetroitBusinessWindow(now: Date) {
  return assertGate3d1BusinessWindow(now, 'America/Detroit')
}

export function getGate3d1GraphPermissionReadiness(input: {
  authMode: GraphAuthMode
  grantedPermissions: readonly string[]
  tenantId?: string | null
  clientId?: string | null
  requiredMailboxObjectId?: string | null
  requiredMailboxAddress?: string | null
  scopedPermissionAttestation?: Gate3d1GraphSession['scopedPermissionAttestation']
}): Gate3d1GraphPermissionReadiness {
  const normalized = new Map(
    input.grantedPermissions.map((permission) => [String(permission).trim().toLowerCase(), String(permission).trim()])
  )
  const attestation = input.scopedPermissionAttestation
  const nowMs = Date.now()
  const verifiedAtMs = attestation ? Date.parse(attestation.verifiedAt) : Number.NaN
  const expiresAtMs = attestation ? Date.parse(attestation.expiresAt) : Number.NaN
  const attestedRoles = new Set((attestation?.roleNames || []).map((role) => role.trim()))
  const attestationReady = Boolean(
    attestation &&
    input.tenantId &&
    input.clientId &&
    input.requiredMailboxObjectId &&
    input.requiredMailboxAddress &&
    attestation.tenantId === input.tenantId &&
    attestation.clientId === input.clientId &&
    attestation.mailboxObjectId === input.requiredMailboxObjectId &&
    attestation.mailboxAddress.trim().toLowerCase() === input.requiredMailboxAddress.trim().toLowerCase() &&
    attestedRoles.size === 2 &&
    attestedRoles.has('Application Mail.ReadWrite') &&
    attestedRoles.has('Application Mail.Send') &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attestation.outOfScopeMailboxObjectId) &&
    attestation.outOfScopeMailboxObjectId !== input.requiredMailboxObjectId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attestation.attestationId) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attestation.founderReviewerUserId) &&
    Number.isFinite(verifiedAtMs) &&
    verifiedAtMs <= nowMs &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs > nowMs &&
    expiresAtMs > verifiedAtMs &&
    expiresAtMs - verifiedAtMs <= 24 * 60 * 60 * 1000 &&
    /^[0-9a-f]{64}$/.test(attestation.inScopeProofFingerprint) &&
    /^[0-9a-f]{64}$/.test(attestation.outOfScopeDenyProofFingerprint) &&
    attestation.inScopeProofFingerprint !== attestation.outOfScopeDenyProofFingerprint &&
    /^[0-9a-f]{32}$/.test(attestation.attestationFingerprint)
  )
  const ready = input.authMode === 'application_credentials' &&
    normalized.size === 0 &&
    attestationReady
  const missingPermissions = ready
    ? []
    : [
        'dedicated app-only token without delegated scopes or Entra application roles',
        'current founder-reviewed Exchange RBAC mailbox attestation',
      ]

  return Object.freeze({
    ready,
    authMode: input.authMode,
    grantedPermissions: Object.freeze(Array.from(normalized.values()).filter(Boolean).sort()),
    missingPermissions: Object.freeze(missingPermissions),
  })
}

function assertExactTargetIdentity(
  expected: Gate3d1GraphReplyRequest,
  actual: GraphMessageIdentity
) {
  const { target } = expected
  if (
    actual.id !== target.inboundImmutableMessageId ||
    actual.conversationId !== target.conversationId ||
    actual.internetMessageId !== target.inboundInternetMessageId ||
    actual.fromAddress.trim().toLowerCase() !== expected.recipientEmail ||
    !actual.toAddresses.some(
      (address) => address.trim().toLowerCase() === target.mailboxAddress
    )
  ) {
    throw new Error('The exact immutable Graph reply target no longer matches the approved canary manifest.')
  }
}

function buildExactThreadEvidence(
  request: Gate3d1GraphReplyRequest,
  draft: GraphMessageIdentity
): Gate3d1GraphThreadEvidence {
  const draftToAddresses = draft.toAddresses.map((address) => address.trim().toLowerCase())
  if (
    !draft.isDraft ||
    draft.conversationId !== request.target.conversationId ||
    !draft.id ||
    /\s/.test(draft.id) ||
    !/^<[^<>\s]+>$/.test(draft.internetMessageId) ||
    draft.fromAddress.trim().toLowerCase() !== request.target.mailboxAddress ||
    draftToAddresses.length !== 1 ||
    draftToAddresses[0] !== request.recipientEmail ||
    (draft.ccAddresses || []).length !== 0 ||
    (draft.bccAddresses || []).length !== 0
  ) {
    throw new Error('Microsoft Graph did not return an exact same-thread immutable reply draft identity.')
  }

  return Object.freeze({
    mailboxObjectId: request.target.mailboxObjectId,
    mailboxAddress: request.target.mailboxAddress,
    recipientEmail: request.recipientEmail,
    targetInboundImmutableMessageId: request.target.inboundImmutableMessageId,
    targetConversationId: request.target.conversationId,
    targetInternetMessageId: request.target.inboundInternetMessageId,
    outboundImmutableMessageId: draft.id,
    outboundInternetMessageId: draft.internetMessageId,
  })
}

function assertExactOutboundIdentity(
  request: Gate3d1GraphReplyRequest,
  thread: Gate3d1GraphThreadEvidence,
  message: GraphMessageIdentity
) {
  const messageToAddresses = message.toAddresses.map((address) => address.trim().toLowerCase())
  if (
    thread.mailboxObjectId !== request.target.mailboxObjectId ||
    thread.mailboxAddress !== request.target.mailboxAddress ||
    thread.recipientEmail !== request.recipientEmail ||
    thread.targetInboundImmutableMessageId !== request.target.inboundImmutableMessageId ||
    thread.targetConversationId !== request.target.conversationId ||
    thread.targetInternetMessageId !== request.target.inboundInternetMessageId ||
    message.id !== thread.outboundImmutableMessageId ||
    message.conversationId !== thread.targetConversationId ||
    message.internetMessageId !== thread.outboundInternetMessageId ||
    message.fromAddress.trim().toLowerCase() !== thread.mailboxAddress ||
    messageToAddresses.length !== 1 ||
    messageToAddresses[0] !== thread.recipientEmail ||
    (message.ccAddresses || []).length !== 0 ||
    (message.bccAddresses || []).length !== 0
  ) {
    throw new Error('The persisted immutable Graph reply identity cannot be reconciled exactly.')
  }
  if (message.isDraft !== true && message.isDraft !== false) {
    throw new Error('Microsoft Graph did not return an exact draft/sent state for the persisted reply.')
  }
  if (
    message.isDraft === false &&
    (!message.sentDateTime || !Number.isFinite(Date.parse(message.sentDateTime)))
  ) {
    throw new Error('The persisted Graph reply is not a draft and has no stable sent timestamp.')
  }
}

export function isExactGate3d1GraphReplyCallback(
  callback: GraphReplyCallbackIdentity,
  thread: Gate3d1GraphThreadEvidence
) {
  const callbackToAddresses = callback.toAddresses.map((address) => address.trim().toLowerCase())
  const inReplyTo = callback.internetMessageHeaders.find(
    (header) => header.name.trim().toLowerCase() === 'in-reply-to'
  )?.value.trim()
  const exactReplyHeader = inReplyTo === thread.outboundInternetMessageId
  return Boolean(
    callback.mailboxObjectId === thread.mailboxObjectId &&
    callback.mailboxAddress.trim().toLowerCase() === thread.mailboxAddress &&
    callback.conversationId === thread.targetConversationId &&
    callback.immutableMessageId !== thread.targetInboundImmutableMessageId &&
    callback.immutableMessageId !== thread.outboundImmutableMessageId &&
    callback.internetMessageId !== thread.targetInternetMessageId &&
    callback.internetMessageId !== thread.outboundInternetMessageId &&
    callback.fromAddress.trim().toLowerCase() === thread.recipientEmail &&
    callbackToAddresses.length === 1 &&
    callbackToAddresses[0] === thread.mailboxAddress &&
    exactReplyHeader
  )
}

export function getGate3d1InboundMailboxScopeReadiness(input: {
  inboundTenantId?: string | null
  dedicatedTenantId?: string | null
  observedTokenTenantId?: string | null
  inboundMailboxObjectId?: string | null
  inboundMailboxAddress?: string | null
  dedicatedMailboxObjectId?: string | null
  dedicatedMailboxAddress?: string | null
}) {
  const inboundMailboxObjectId = String(input.inboundMailboxObjectId || '').trim()
  const dedicatedMailboxObjectId = String(input.dedicatedMailboxObjectId || '').trim()
  const inboundTenantId = String(input.inboundTenantId || '').trim()
  const dedicatedTenantId = String(input.dedicatedTenantId || '').trim()
  const observedTokenTenantId = input.observedTokenTenantId === undefined
    ? null
    : String(input.observedTokenTenantId || '').trim()
  const inboundMailboxAddress = String(input.inboundMailboxAddress || '').trim().toLowerCase()
  const dedicatedMailboxAddress = String(input.dedicatedMailboxAddress || '').trim().toLowerCase()
  const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  let blocker: string | null = null
  if (!canonicalUuid.test(inboundTenantId)) {
    blocker = 'Inbound Outlook sync is not pinned to a canonical Microsoft tenant ID.'
  } else if (!canonicalUuid.test(dedicatedTenantId)) {
    blocker = 'The dedicated Gate 3D.1 Microsoft tenant ID is not canonical.'
  } else if (inboundTenantId !== dedicatedTenantId) {
    blocker = 'Inbound Outlook sync and Gate 3D.1 sender tenant IDs do not match exactly.'
  } else if (
    observedTokenTenantId !== null &&
    (!canonicalUuid.test(observedTokenTenantId) || observedTokenTenantId !== inboundTenantId)
  ) {
    blocker = 'The actual inbound Microsoft access token tenant does not match the pinned Gate 3D.1 tenant.'
  } else if (!canonicalUuid.test(inboundMailboxObjectId)) {
    blocker = 'Inbound Outlook sync is not pinned to a canonical mailbox object ID.'
  } else if (!canonicalUuid.test(dedicatedMailboxObjectId)) {
    blocker = 'The dedicated Gate 3D.1 mailbox object ID is not canonical.'
  } else if (inboundMailboxObjectId !== dedicatedMailboxObjectId) {
    blocker = 'Inbound Outlook sync and Gate 3D.1 sender mailbox object IDs do not match exactly.'
  } else if (!inboundMailboxAddress || inboundMailboxAddress !== dedicatedMailboxAddress) {
    blocker = 'Inbound Outlook sync and Gate 3D.1 sender mailbox addresses do not match exactly.'
  }
  return {
    ready: blocker === null,
    blocker,
    observedMailboxObjectId: blocker === null ? inboundMailboxObjectId : null,
    observedMailboxAddress: blocker === null ? inboundMailboxAddress : null,
    observedTenantId:
      blocker === null && observedTokenTenantId !== null ? observedTokenTenantId : null,
  }
}

export function resolveMicrosoftGraphAccessTokenTenantId(accessToken: string) {
  const parts = String(accessToken || '').split('.')
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('Microsoft Graph access token is not a verifiable JWT.')
  }
  let claims: unknown
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    throw new Error('Microsoft Graph access token claims could not be decoded.')
  }
  const tenantId = claims && typeof claims === 'object' && !Array.isArray(claims)
    ? String((claims as Record<string, unknown>).tid || '').trim()
    : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(tenantId)) {
    throw new Error('Microsoft Graph access token is missing its canonical tenant ID.')
  }
  return tenantId
}

export async function runGate3d1GraphSameThreadReplyCanary(
  rawRequest: Gate3d1GraphReplyRequest,
  dependencies: Gate3d1GraphReplyDependencies
) {
  const request = normalizeGate3d1GraphReplyRequest(rawRequest)
  let binding: OperatingStrategyBinding | null = null
  let claim: Gate3d1DispatchClaim | null = null
  let reservation: Gate3d1DispatchReservation | null = null
  let intent: Gate3d1DispatchIntent | null = null
  let thread: Gate3d1GraphThreadEvidence | null = null
  let failurePhase = 'initial_preflight'
  try {
  await dependencies.assertActivation(request)
  assertGate3d1BusinessWindow(dependencies.now(), request.recipientTimeZone)

  binding = await dependencies.authorize(request)
  if (binding.operatingStrategyVersionId !== request.operatingStrategyVersionId) {
    throw new Error('The active operating strategy version does not match the authorized execution manifest.')
  }
  if (binding.contractFingerprint !== request.contractFingerprint) {
    throw new Error('The active operating contract fingerprint does not match the founder-approved canary.')
  }
  const preflight = await dependencies.assertNoStopSignal(request, 'before_reservation')
  failurePhase = 'claim_authorization'
  claim = await dependencies.claimAuthorization({ request, binding, preflight })
  requireUuid(claim.claimId, 'Gate 3D.1 dispatch claim ID')
  if (
    claim.authorizationId !== request.authorizationId ||
    claim.exchangeRbacAttestationId !== request.exchangeRbacAttestationId ||
    !Number.isFinite(Date.parse(claim.expiresAt)) ||
    Date.parse(claim.expiresAt) <= dependencies.now().getTime() ||
    !/^[0-9a-f]{32}$/.test(claim.claimFingerprint) ||
    !claim.consentBasisSnapshot ||
    typeof claim.consentBasisSnapshot !== 'object' ||
    Array.isArray(claim.consentBasisSnapshot) ||
    claim.consentBasisSnapshot.authorizationId !== claim.authorizationId ||
    claim.consentBasisSnapshot.claimId !== claim.claimId
  ) {
    throw new Error('The one-shot claim returned incomplete or conflicting immutable authorization evidence.')
  }
  failurePhase = 'dispatch_reservation'
  reservation = await dependencies.reserve(request, binding, claim)
  requireUuid(reservation.reservationId, 'Gate 3D.1 dispatch reservation ID')
  await dependencies.bindReservation({ request, binding, claim, reservation })
  const dispatchIntentAt = dependencies.now().toISOString()
  failurePhase = 'persist_dispatch_intent'
  const persistedIntent = await dependencies.persistIntent({
    request,
    binding,
    claim,
    reservation,
    preflight,
    dispatchIntentAt,
  })
  requireUuid(persistedIntent.enrollmentId, 'Gate 3D.1 outbound enrollment ID')
  requireUuid(persistedIntent.canonicalActivityId, 'Gate 3D.1 canonical enrollment activity ID')
  failurePhase = 'confirm_dispatch_intent'
  intent = await dependencies.confirmIntent({
    request,
    binding,
    claim,
    reservation,
    intent: persistedIntent,
  })
  if (intent.enrollmentId !== persistedIntent.enrollmentId) {
    throw new Error('The confirmed Gate 3D.1 intent changed its durable outbound enrollment identity.')
  }
  if (intent.canonicalActivityId !== persistedIntent.canonicalActivityId) {
    throw new Error('The confirmed Gate 3D.1 intent changed its canonical activity identity.')
  }
  if (intent.claimId !== claim.claimId) {
    throw new Error('The durable dispatch intent does not match the atomically claimed one-shot authorization.')
  }
  const effectiveDispatchIntentAt = intent.dispatchIntentAt || dispatchIntentAt

  thread = intent.existingThread || null
  if (intent.state === 'reconciled_not_sent' || intent.state === 'dead_lettered') {
    failurePhase = `terminal_${intent.state}`
    await dependencies.failClosed({
      request,
      binding,
      claim,
      reservation,
      intent,
      thread,
      failurePhase,
    })
    return Object.freeze({
      ok: false as const,
      provider: 'outlook_graph' as const,
      enrollmentId: intent.enrollmentId,
      claimId: claim.claimId,
      reservationId: reservation.reservationId,
      reconciliationRequired: false as const,
      state: intent.state,
      thread,
    })
  }

  // No Microsoft identity or Graph resource call is allowed above this line.
  // The durable reservation and dispatch intent are the recovery boundary.
  failurePhase = 'graph_session_readiness'
  const session = await dependencies.getGraphSession(request, claim)
  const permissionReadiness = getGate3d1GraphPermissionReadiness({
    ...session,
    requiredMailboxObjectId: request.target.mailboxObjectId,
    requiredMailboxAddress: request.target.mailboxAddress,
  })
  if (!permissionReadiness.ready) {
    throw new Error(
      `Microsoft Graph same-thread reply is blocked; missing ${permissionReadiness.missingPermissions.join(' and ')}.`
    )
  }

  if (['draft_attempted', 'send_attempted', 'ambiguous'].includes(intent.state)) {
    failurePhase = `recovery_${intent.state}`
    if (thread) {
      const observed = await dependencies.getOutboundMessage(
        session,
        request.target,
        thread.outboundImmutableMessageId
      )
      assertExactOutboundIdentity(request, thread, observed)
    }
    await dependencies.failClosed({
      request,
      binding,
      claim,
      reservation,
      intent,
      thread,
      failurePhase,
    })
    return Object.freeze({
      ok: false as const,
      provider: 'outlook_graph' as const,
      enrollmentId: intent.enrollmentId,
      claimId: claim.claimId,
      reservationId: reservation.reservationId,
      reconciliationRequired: true as const,
      state: intent.state,
      thread,
    })
  }
  if (intent.state === 'accepted' || intent.state === 'reconciled_accepted') {
    failurePhase = 'accepted_recovery'
    if (!thread) {
      throw new Error('An accepted Gate 3D.1 dispatch has no immutable outbound Graph identity.')
    }
    const acceptedMessage = await dependencies.getOutboundMessage(
      session,
      request.target,
      thread.outboundImmutableMessageId
    )
    assertExactOutboundIdentity(request, thread, acceptedMessage)
    if (acceptedMessage.isDraft !== false) {
      throw new Error('An accepted Gate 3D.1 dispatch still resolves to a Graph draft; founder reconciliation is required.')
    }
    const acceptedAt = acceptedMessage.sentDateTime!
    await dependencies.persistAccepted({
      request,
      binding,
      claim,
      reservation,
      preflight,
      intent,
      dispatchIntentAt: effectiveDispatchIntentAt,
      acceptedAt,
      thread,
    })
    await dependencies.ensureStopsEngaged({
      request,
      binding,
      phase: 'accepted_recovery',
    })
    return Object.freeze({
      ok: true as const,
      provider: 'outlook_graph' as const,
      enrollmentId: intent.enrollmentId,
      claimId: claim.claimId,
      reservationId: reservation.reservationId,
      acceptedAt,
      reconciledWithoutSend: true as const,
      thread,
    })
  }
  if (intent.state !== 'intent_confirmed' && intent.state !== 'draft_created') {
    throw new Error('The Gate 3D.1 claim returned an unsupported dispatch state.')
  }
  if (intent.state === 'intent_confirmed' && thread) {
    throw new Error('The intent state conflicts with an existing Graph draft; automatic execution is blocked.')
  }
  if (intent.state === 'draft_created' && !thread) {
    throw new Error('The draft-created state is missing its immutable Graph identity.')
  }
  if (thread) {
    failurePhase = 'draft_recovery'
    const existing = await dependencies.getOutboundMessage(
      session,
      request.target,
      thread.outboundImmutableMessageId
    )
    assertExactOutboundIdentity(request, thread, existing)
    if (existing.isDraft === false) {
      throw new Error('A sent Graph message was observed before the one-shot send permit; founder reconciliation is required.')
    }
  } else {
    failurePhase = 'target_identity_recheck'
    const targetMessage = await dependencies.getTargetMessage(session, request.target)
    assertExactTargetIdentity(request, targetMessage)
    await dependencies.assertActivation(request)
    assertGate3d1BusinessWindow(dependencies.now(), request.recipientTimeZone)
    await dependencies.assertNoStopSignal(request, 'before_create_reply')
    await dependencies.assertProviderMutationAllowed({
      request,
      binding,
      claim,
      reservation,
      intent,
      mutation: 'create_reply',
    })
    failurePhase = 'begin_graph_draft_attempt'
    await dependencies.beginDraftAttempt({ request, binding, claim, reservation, intent })
    try {
      failurePhase = 'graph_create_reply'
      const draft = await dependencies.createReplyDraft(session, request)
      thread = buildExactThreadEvidence(request, draft)
      failurePhase = 'persist_graph_draft_identity'
      await dependencies.persistDraftIdentity({
        request,
        binding,
        claim,
        reservation,
        preflight,
        intent,
        dispatchIntentAt: effectiveDispatchIntentAt,
        thread,
      })
      await dependencies.recordDraftResult({
        request,
        binding,
        claim,
        reservation,
        intent,
        outcome: 'draft_created',
        thread,
      })
    } catch (error) {
      try {
        await dependencies.recordDraftResult({
          request,
          binding,
          claim,
          reservation,
          intent,
          outcome: 'ambiguous',
          thread,
          errorCode: 'graph_draft_attempt_ambiguous',
        })
      } catch (recordError) {
        throw new Error(
          `Graph draft attempt failed and its ambiguous result could not be persisted: ${recordError instanceof Error ? recordError.message : 'unknown transition error'}.`,
          { cause: error }
        )
      }
      throw error
    }
  }

  // Re-check all stop and time gates after the draft exists and immediately
  // before the only external-send call. A stopped draft remains unsent.
  failurePhase = 'before_send_recheck'
  await dependencies.assertActivation(request)
  assertGate3d1BusinessWindow(dependencies.now(), request.recipientTimeZone)
  await dependencies.assertNoStopSignal(request, 'before_send')
  await dependencies.assertProviderMutationAllowed({
    request,
    binding,
    claim,
    reservation,
    intent,
    mutation: 'send',
  })
  failurePhase = 'begin_send_attempt'
  await dependencies.beginSendAttempt({ request, binding, claim, reservation, intent, thread })
  try {
    failurePhase = 'graph_send'
    const providerResult = await dependencies.sendReplyDraft(
      session,
      request.target,
      thread.outboundImmutableMessageId
    )
    if (providerResult.status !== 202) {
      throw new Error('Microsoft Graph did not return the expected 202 response for the exact reply draft.')
    }
  } catch (error) {
    try {
      await dependencies.recordSendResult({
        request,
        binding,
        claim,
        reservation,
        intent,
        outcome: 'ambiguous',
        thread,
        errorCode: 'graph_send_attempt_ambiguous',
      })
    } catch (recordError) {
      throw new Error(
        `Graph send became ambiguous and its stop state could not be persisted: ${recordError instanceof Error ? recordError.message : 'unknown transition error'}.`,
        { cause: error }
      )
    }
    throw error
  }

  let sentMessage: GraphMessageIdentity
  try {
    failurePhase = 'post_send_reconciliation'
    sentMessage = await dependencies.getOutboundMessage(
      session,
      request.target,
      thread.outboundImmutableMessageId
    )
    assertExactOutboundIdentity(request, thread, sentMessage)
  } catch (error) {
    await dependencies.recordSendResult({
      request,
      binding,
      claim,
      reservation,
      intent,
      outcome: 'ambiguous',
      thread,
      errorCode: 'graph_send_reconciliation_unavailable',
    })
    throw new Error('Microsoft Graph accepted the send request but exact immutable-ID reconciliation is required.', { cause: error })
  }
  if (sentMessage.isDraft !== false) {
    await dependencies.recordSendResult({
      request,
      binding,
      claim,
      reservation,
      intent,
      outcome: 'ambiguous',
      thread,
      errorCode: 'graph_send_reconciliation_still_draft',
    })
    throw new Error('Microsoft Graph returned 202 but the immutable message still resolves to a draft; founder reconciliation is required.')
  }

  const acceptedAt = sentMessage.sentDateTime!
  await dependencies.recordSendResult({
    request,
    binding,
    claim,
    reservation,
    intent,
    outcome: 'accepted',
    thread,
    acceptedAt,
  })
  failurePhase = 'persist_accepted_outcome'
  await dependencies.persistAccepted({
    request,
    binding,
    claim,
    reservation,
    preflight,
    intent,
    dispatchIntentAt: effectiveDispatchIntentAt,
    acceptedAt,
    thread,
  })
  await dependencies.ensureStopsEngaged({
    request,
    binding,
    phase: 'accepted_delivery',
  })

  return Object.freeze({
    ok: true as const,
    provider: 'outlook_graph' as const,
    enrollmentId: intent.enrollmentId,
    claimId: claim.claimId,
    reservationId: reservation.reservationId,
    acceptedAt,
    thread,
  })
  } catch (error) {
    try {
      await dependencies.failClosed({
        request,
        binding,
        claim,
        reservation,
        intent,
        thread,
        failurePhase,
      })
    } catch (stopError) {
      throw new Error(
        `Gate 3D.1 failed during ${failurePhase}, and its fail-safe stop could not be confirmed: ${stopError instanceof Error ? stopError.message : 'unknown stop error'}.`,
        { cause: error }
      )
    }
    throw error
  }
}
