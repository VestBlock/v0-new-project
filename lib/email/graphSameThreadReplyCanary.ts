import 'server-only'

import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { recordStrategyDeliveryOutcome } from '@/lib/admin/strategyDelivery'
import { getConfiguredGate3d1InboundMailboxScope } from '@/lib/email/gate3d1InboundMailboxScope'
import {
  fingerprintGate3d1GraphReplyContent,
  fingerprintGate3d1GraphReplyThread,
  hasExactGate3d1ReplyMemoryProvenance,
  isConservativePositiveSellerReplyText,
  resolveGate3d1GraphApplicationClientId,
  runGate3d1GraphSameThreadReplyCanary,
  type Gate3d1CanaryPreflight,
  type Gate3d1GraphReplyDependencies,
  type Gate3d1GraphReplyRequest,
  type Gate3d1GraphReplyTarget,
  type Gate3d1GraphSession,
  type Gate3d1GraphThreadEvidence,
  type GraphMessageIdentity,
} from '@/lib/email/graphSameThreadReplyCore'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY,
  GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
} from '@/lib/strategy/gate3d1-seller-reply-canary'
import {
  authorizeGate3d1CanaryDispatch,
  reserveGate3d1CanaryDispatch,
  type OperatingStrategyBinding,
} from '@/lib/strategy/runtime-governance'

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0'
const GATE3D1_WRITER_RELEASE = GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE
const GRAPH_AUDIENCES = new Set([
  '00000003-0000-0000-c000-000000000000',
  'https://graph.microsoft.com',
])
const STOP_STATUSES = new Set([
  'bounced',
  'complained',
  'suppressed',
  'do_not_contact',
])
const GATE3D1_OPT_OUT_SENTENCE =
  'If you prefer not to receive further messages, reply STOP and we will honor your request.'

type GraphApiMessage = {
  id?: string | null
  conversationId?: string | null
  internetMessageId?: string | null
  isDraft?: boolean | null
  sentDateTime?: string | null
  from?: { emailAddress?: { address?: string | null } | null } | null
  toRecipients?: Array<{ emailAddress?: { address?: string | null } | null }>
  ccRecipients?: Array<{ emailAddress?: { address?: string | null } | null }>
  bccRecipients?: Array<{ emailAddress?: { address?: string | null } | null }>
}

type GraphTokenClaims = {
  aud?: string | string[]
  tid?: string
  appid?: string
  azp?: string
  ver?: string
  roles?: string[]
  scp?: string
}

function exactEnv(name: string) {
  return String(process.env[name] || '').trim()
}

function dedicatedGraphConfig() {
  return {
    tenantId: exactEnv('GATE3D1_GRAPH_TENANT_ID'),
    clientId: exactEnv('GATE3D1_GRAPH_CLIENT_ID'),
    clientSecret: exactEnv('GATE3D1_GRAPH_CLIENT_SECRET'),
    mailboxObjectId: exactEnv('GATE3D1_GRAPH_MAILBOX_OBJECT_ID'),
    mailboxAddress: exactEnv('GATE3D1_GRAPH_MAILBOX_ADDRESS').toLowerCase(),
  }
}

function gate3d1MailingAddress() {
  const address = exactEnv('OUTREACH_MAILING_ADDRESS').replace(/\s+/g, ' ').trim()
  if (!address || address.length > 500) {
    throw new Error('Gate 3D.1 requires the configured physical postal identity.')
  }
  return address
}

export function buildGate3d1CompliantReplyComment(authoredComment: string) {
  const authored = String(authoredComment || '').trim()
  if (!authored) throw new Error('Gate 3D.1 requires an authored reply comment.')
  const result = `${authored}\n\n${GATE3D1_OPT_OUT_SENTENCE}\n${gate3d1MailingAddress()}`
  if (result.length > 10_000) {
    throw new Error('Gate 3D.1 reply content exceeds the exact provider body limit.')
  }
  return result
}

export function hasExactGate3d1ComplianceFooter(comment: string) {
  const suffix = `${GATE3D1_OPT_OUT_SENTENCE}\n${gate3d1MailingAddress()}`
  return comment.endsWith(suffix)
}

async function getDedicatedGraphApplicationAccessToken() {
  const config = dedicatedGraphConfig()
  if (!config.tenantId || !config.clientId || !config.clientSecret) {
    throw new Error('Dedicated Gate 3D.1 Microsoft Graph application credentials are not configured.')
  }
  const response = await fetch(
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
      signal: AbortSignal.timeout(20_000),
    }
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.access_token) {
    const providerCode = typeof data?.error === 'string' ? data.error : 'unknown_error'
    throw new Error(`Dedicated Gate 3D.1 Microsoft application token request failed (${providerCode}).`)
  }
  return data.access_token as string
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function sha256Evidence(value: Record<string, unknown>) {
  return sha256(JSON.stringify(value))
}

function rpcRows<T>(data: unknown, label: string) {
  const rows = (Array.isArray(data) ? data : data ? [data] : []) as T[]
  if (rows.length !== 1) {
    throw new Error(`${label} must return exactly one immutable record.`)
  }
  return rows[0]
}

function exactUuid(value: unknown, label: string) {
  const normalized = String(value || '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`${label} is not an exact UUID.`)
  }
  return normalized
}

function transitionIdempotency(request: Gate3d1GraphReplyRequest, step: string) {
  return `${request.idempotencyKey}:${step}`
}

type ProviderDispatchAuthorization = {
  reservation_id: string
  operating_strategy_version_id: string
  channel: string
  expires_at: string
  authorization_fingerprint: string
  claim_id: string
  authorization_id: string
  exchange_rbac_attestation_id: string
  dispatch_state: string
}

type Gate3d1DispatchStateRow = {
  claim_id: string
  authorization_id: string
  operating_strategy_version_id: string
  dispatch_state: string
  sequence_number: number
  reservation_id: string | null
  outbound_enrollment_id: string | null
  canonical_activity_id: string | null
  provider_draft_id_hash: string | null
  provider_conversation_id_hash: string | null
  provider_internet_message_id_hash: string | null
  provider_evidence_fingerprint: string | null
  claim_expires_at: string
  event_recorded_at: string
  global_stop_engaged: boolean
  strategy_stop_engaged: boolean
  automatic_provider_retry_allowed: boolean
}

async function getGate3d1DispatchState(input: {
  request: Gate3d1GraphReplyRequest
  claimId: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_gate3d1_canary_dispatch_state', {
    p_claim_id: input.claimId,
    p_authorization_id: input.request.authorizationId,
    p_writer_release: GATE3D1_WRITER_RELEASE,
  })
  if (error) {
    throw new Error(`Gate 3D.1 recovery-state assertion failed closed: ${error.message}`)
  }
  const row = rpcRows<Gate3d1DispatchStateRow>(data, 'Gate 3D.1 recovery state')
  if (
    row.claim_id !== input.claimId ||
    row.authorization_id !== input.request.authorizationId ||
    row.operating_strategy_version_id !== input.request.operatingStrategyVersionId ||
    !Number.isInteger(Number(row.sequence_number)) ||
    Number(row.sequence_number) < 1 ||
    !Number.isFinite(Date.parse(row.claim_expires_at)) ||
    !Number.isFinite(Date.parse(row.event_recorded_at))
  ) {
    throw new Error('Gate 3D.1 recovery state returned incomplete or conflicting immutable evidence.')
  }
  return row
}

async function assertGate3d1ProviderDispatch(input: {
  request: Gate3d1GraphReplyRequest
  binding: OperatingStrategyBinding
  claimId: string
  reservationId: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('assert_operating_strategy_dispatch_authorized', {
    p_reservation_id: input.reservationId,
    p_operating_strategy_version_id: input.binding.operatingStrategyVersionId,
    p_channel: 'outlook_graph',
    p_writer_release: GATE3D1_WRITER_RELEASE,
  })
  if (error) {
    throw new Error(`Gate 3D.1 pre-provider authorization failed closed: ${error.message}`)
  }
  const row = rpcRows<ProviderDispatchAuthorization>(data, 'Gate 3D.1 pre-provider authorization')
  if (
    row.reservation_id !== input.reservationId ||
    row.operating_strategy_version_id !== input.binding.operatingStrategyVersionId ||
    row.channel !== 'outlook_graph' ||
    row.claim_id !== input.claimId ||
    row.authorization_id !== input.request.authorizationId ||
    row.exchange_rbac_attestation_id !== input.request.exchangeRbacAttestationId ||
    !Number.isFinite(Date.parse(row.expires_at)) ||
    Date.parse(row.expires_at) <= Date.now() ||
    !/^[0-9a-f]{64}$/.test(row.authorization_fingerprint)
  ) {
    throw new Error('Gate 3D.1 pre-provider authorization returned incomplete or conflicting evidence.')
  }
  return row
}

function graphThreadMetadata(thread: Gate3d1GraphThreadEvidence) {
  return {
    idType: 'restImmutableEntryId',
    mailboxObjectId: thread.mailboxObjectId,
    mailboxAddress: thread.mailboxAddress,
    recipientEmail: thread.recipientEmail,
    targetInboundImmutableMessageId: thread.targetInboundImmutableMessageId,
    targetConversationId: thread.targetConversationId,
    targetInternetMessageId: thread.targetInternetMessageId,
    outboundImmutableMessageId: thread.outboundImmutableMessageId,
    outboundInternetMessageId: thread.outboundInternetMessageId,
  }
}

function graphThreadFromMetadata(metadata: unknown): Gate3d1GraphThreadEvidence | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>).graphReplyThread
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const candidate = raw as Record<string, unknown>
  const thread: Gate3d1GraphThreadEvidence = {
    mailboxObjectId: String(candidate.mailboxObjectId || ''),
    mailboxAddress: String(candidate.mailboxAddress || '').trim().toLowerCase(),
    recipientEmail: String(candidate.recipientEmail || '').trim().toLowerCase(),
    targetInboundImmutableMessageId: String(candidate.targetInboundImmutableMessageId || ''),
    targetConversationId: String(candidate.targetConversationId || ''),
    targetInternetMessageId: String(candidate.targetInternetMessageId || ''),
    outboundImmutableMessageId: String(candidate.outboundImmutableMessageId || ''),
    outboundInternetMessageId: String(candidate.outboundInternetMessageId || ''),
  }
  return Object.values(thread).every(Boolean) ? thread : null
}

function decodeGraphTokenClaims(accessToken: string): GraphTokenClaims {
  const segments = accessToken.split('.')
  if (segments.length < 2) {
    throw new Error('Microsoft Graph access token is not a JWT; permission readiness cannot be proven.')
  }
  try {
    const claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as GraphTokenClaims
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    if (!audiences.some((audience) => audience && GRAPH_AUDIENCES.has(audience))) {
      throw new Error('Microsoft access token audience is not Microsoft Graph.')
    }
    return claims
  } catch (error) {
    if (error instanceof Error && error.message.includes('audience')) throw error
    throw new Error('Microsoft Graph access-token permission claims could not be decoded.')
  }
}

function graphMessageIdentity(message: GraphApiMessage): GraphMessageIdentity {
  const addresses = (recipients: GraphApiMessage['toRecipients']) => (recipients || [])
    .map((recipient) => String(recipient.emailAddress?.address || '').trim().toLowerCase())
    .filter(Boolean)
  return {
    id: String(message.id || ''),
    conversationId: String(message.conversationId || ''),
    internetMessageId: String(message.internetMessageId || ''),
    fromAddress: String(message.from?.emailAddress?.address || '').trim().toLowerCase(),
    toAddresses: addresses(message.toRecipients),
    ccAddresses: addresses(message.ccRecipients),
    bccAddresses: addresses(message.bccRecipients),
    isDraft: message.isDraft === true,
    sentDateTime: message.sentDateTime || null,
  }
}

async function graphJson(input: {
  session: Gate3d1GraphSession
  path: string
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  expectedStatus: 200 | 201
}) {
  const response = await fetch(`${GRAPH_ROOT}${input.path}`, {
    method: input.method || 'GET',
    headers: {
      Authorization: `Bearer ${input.session.accessToken}`,
      Accept: 'application/json',
      Prefer: 'IdType="ImmutableId"',
      ...(input.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(input.body ? { body: JSON.stringify(input.body) } : {}),
    signal: AbortSignal.timeout(20_000),
  })
  const data = await response.json().catch(() => ({}))
  if (response.status !== input.expectedStatus) {
    const providerCode = typeof data?.error?.code === 'string' ? data.error.code : 'unknown_error'
    throw new Error(`Microsoft Graph request failed with ${response.status} (${providerCode}).`)
  }
  return data as GraphApiMessage
}

async function graphAccepted(input: {
  session: Gate3d1GraphSession
  path: string
}) {
  const response = await fetch(`${GRAPH_ROOT}${input.path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.session.accessToken}`,
      Prefer: 'IdType="ImmutableId"',
      'Content-Length': '0',
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (response.status !== 202) {
    const data = await response.json().catch(() => ({}))
    const providerCode = typeof data?.error?.code === 'string' ? data.error.code : 'unknown_error'
    throw new Error(`Microsoft Graph send failed with ${response.status} (${providerCode}).`)
  }
  return { status: 202 as const }
}

function assertExactCanaryActivation(request: Gate3d1GraphReplyRequest) {
  const callbackScope = getConfiguredGate3d1InboundMailboxScope()
  const checks: Array<[boolean, string]> = [
    [exactEnv('GATE3D1_GRAPH_REPLY_CANARY_ENABLED') === 'true', 'The Gate 3D.1 Graph canary is disabled.'],
    [exactEnv('GATE3D1_GRAPH_REPLY_CANARY_MAX_SENDS') === '1', 'The Graph canary cap must equal exactly one.'],
    [
      callbackScope.ready,
      callbackScope.blocker || 'The exact inbound Outlook callback scope is not ready.',
    ],
    [
      exactEnv('GATE3D1_GRAPH_REPLY_CANARY_RECIPIENT_SHA256') === sha256(request.recipientEmail),
      'The recipient is not the single pinned Graph canary recipient.',
    ],
    [
      exactEnv('GATE3D1_GRAPH_MAILBOX_OBJECT_ID') === request.target.mailboxObjectId,
      'The mailbox object ID is not the pinned Graph canary mailbox.',
    ],
    [
      exactEnv('GATE3D1_GRAPH_MAILBOX_ADDRESS').toLowerCase() === request.target.mailboxAddress,
      'The mailbox address is not the pinned Graph canary mailbox.',
    ],
    [
      exactEnv('GATE3D1_GRAPH_REPLY_CANARY_APPROVAL_MANIFEST_KEY') ===
        GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY &&
        request.approvalManifestKey === GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY,
      'The request does not match the pinned founder approval manifest.',
    ],
    [
      hasExactGate3d1ComplianceFooter(request.comment),
      'The exact approved reply is missing VestBlock postal identity or the clear opt-out.',
    ],
  ]
  const failed = checks.find(([passes]) => !passes)
  if (failed) throw new Error(failed[1])
}

async function getGraphSession(
  request: Gate3d1GraphReplyRequest
): Promise<Gate3d1GraphSession> {
  const config = dedicatedGraphConfig()
  if (
    !config.tenantId ||
    !config.clientId ||
    !config.clientSecret ||
    !config.mailboxObjectId ||
    !config.mailboxAddress
  ) {
    throw new Error('All five dedicated Gate 3D.1 Graph sender settings are required.')
  }
  const admin = createAdminClient()
  const { data: attestationData, error: attestationError } = await admin.rpc(
    'assert_gate3d1_graph_rbac_attestation_current',
    {
      p_tenant_id: config.tenantId,
      p_client_id: config.clientId,
      p_mailbox_object_id: config.mailboxObjectId,
      p_mailbox_address: config.mailboxAddress,
    }
  )
  if (attestationError) {
    throw new Error(`Gate 3D.1 Exchange Application RBAC readiness failed closed: ${attestationError.message}`)
  }
  const attestation = rpcRows<{
    attestation_id: string
    tenant_id: string
    client_id: string
    mailbox_object_id: string
    mailbox_address: string
    rbac_role_set_json: unknown
    rbac_roles: string[]
    out_of_scope_mailbox_object_id: string
    founder_reviewer_user_id: string
    verified_at: string
    expires_at: string
    in_scope_proof_fingerprint: string
    out_of_scope_deny_proof_fingerprint: string
    attestation_fingerprint: string
  }>(attestationData, 'Gate 3D.1 Exchange Application RBAC readiness')
  if (
    attestation.attestation_id !== request.exchangeRbacAttestationId ||
    attestation.tenant_id !== config.tenantId ||
    attestation.client_id !== config.clientId ||
    attestation.mailbox_object_id !== config.mailboxObjectId ||
    attestation.mailbox_address !== config.mailboxAddress ||
    !isDeepStrictEqual(attestation.rbac_role_set_json, [
      'Application Mail.ReadWrite',
      'Application Mail.Send',
    ])
  ) {
    throw new Error('Gate 3D.1 RBAC readiness does not match the exact claimed dedicated sender identity.')
  }
  const accessToken = await getDedicatedGraphApplicationAccessToken()
  const claims = decodeGraphTokenClaims(accessToken)
  const tenantId = String(claims.tid || '').trim()
  if (!tenantId) {
    throw new Error('Microsoft Graph application token is missing its exact tenant identity claim.')
  }
  const clientId = resolveGate3d1GraphApplicationClientId({
    tokenVersion: claims.ver,
    authorizedPartyClientId: claims.azp,
    applicationClientId: claims.appid,
    expectedClientId: config.clientId,
  })
  if (
    tenantId !== config.tenantId
  ) {
    throw new Error('Microsoft Graph application token identity does not match the dedicated Gate 3D.1 configuration.')
  }
  const grantedPermissions = [
    ...(Array.isArray(claims.roles) ? claims.roles : []),
    ...String(claims.scp || '').split(/\s+/),
  ].map((permission) => permission.trim()).filter(Boolean)
  if (grantedPermissions.length > 0) {
    throw new Error('Gate 3D.1 rejects delegated scopes and Entra application roles; use only mailbox-scoped Exchange Application RBAC.')
  }
  return {
    accessToken,
    authMode: 'application_credentials',
    grantedPermissions,
    tenantId,
    clientId,
    scopedPermissionAttestation: {
      attestationId: attestation.attestation_id,
      tenantId: attestation.tenant_id,
      clientId: attestation.client_id,
      mailboxObjectId: attestation.mailbox_object_id,
      mailboxAddress: attestation.mailbox_address,
      roleNames: attestation.rbac_roles,
      outOfScopeMailboxObjectId: attestation.out_of_scope_mailbox_object_id,
      founderReviewerUserId: attestation.founder_reviewer_user_id,
      verifiedAt: attestation.verified_at,
      expiresAt: attestation.expires_at,
      inScopeProofFingerprint: attestation.in_scope_proof_fingerprint,
      outOfScopeDenyProofFingerprint: attestation.out_of_scope_deny_proof_fingerprint,
      attestationFingerprint: attestation.attestation_fingerprint,
    },
  }
}

function stoppedStatus(value: unknown) {
  return STOP_STATUSES.has(String(value || '').trim().toLowerCase())
}

async function assertNoStopSignal(
  request: Gate3d1GraphReplyRequest,
  phase: 'before_reservation' | 'before_create_reply' | 'before_send'
): Promise<Gate3d1CanaryPreflight> {
  const admin = createAdminClient()
  const graphConfig = dedicatedGraphConfig()
  const [leadResult, suppressionResult, enrollmentResult, sendEventResult, targetResult] = await Promise.all([
    admin
      .from('leads')
      .select('id,email,status,outreach_status,delivery_status,city,state,property_address')
      .eq('id', request.leadId)
      .limit(2),
    admin
      .from('lead_suppressions')
      .select('id,reason,status')
      .eq('email', request.recipientEmail)
      .eq('status', 'active')
      .limit(2),
    admin
      .from('command_center_outbound_enrollments')
      .select('id,status,last_message_id,updated_at')
      .eq('recipient', request.recipientEmail)
      .eq('channel', 'email')
      .in('status', ['replied', 'bounced', 'complained', 'suppressed'])
      .limit(2),
    admin
      .from('outreach_send_events')
      .select('id,status,created_at')
      .eq('lead_id', request.leadId)
      .eq('channel', 'email')
      .in('status', ['replied', 'bounced', 'complained', 'suppressed'])
      .order('created_at', { ascending: false })
      .limit(2),
    admin
      .from('command_center_reply_memory')
      .select('id,lead_id,mailbox,thread_id,message_id,from_email,to_email,subject,reply_summary,property_address,received_at,classification,metadata_json')
      .eq('id', request.replyMemoryId)
      .eq('mailbox', request.target.mailboxAddress)
      .eq('message_id', request.target.inboundImmutableMessageId)
      .limit(2),
  ])
  for (const result of [leadResult, suppressionResult, enrollmentResult, sendEventResult, targetResult]) {
    if (result.error) throw result.error
  }

  if ((leadResult.data || []).length !== 1) {
    throw new Error('Gate 3D.1 requires exactly one lead record.')
  }
  if ((targetResult.data || []).length !== 1) {
    throw new Error('Gate 3D.1 requires exactly one immutable inbound Graph reply-memory record.')
  }
  const lead = leadResult.data![0]
  const target = targetResult.data![0]
  const targetMetadata = (target.metadata_json || {}) as Record<string, unknown>
  const targetReceivedAt = String(target.received_at || '')
  if (!Number.isFinite(Date.parse(targetReceivedAt))) {
    throw new Error('The immutable Graph reply target is missing a stable received timestamp.')
  }

  const { data: newerReplies, error: newerRepliesError } = await admin
    .from('command_center_reply_memory')
    .select('message_id,received_at')
    .eq('mailbox', request.target.mailboxAddress)
    .eq('thread_id', request.target.conversationId)
    .eq('from_email', request.recipientEmail)
    .gt('received_at', targetReceivedAt)
    .neq('message_id', request.target.inboundImmutableMessageId)
    .limit(2)
  if (newerRepliesError) throw newerRepliesError

  const stopReasons: string[] = []
  if (String(lead.email || '').trim().toLowerCase() !== request.recipientEmail) stopReasons.push('recipient_identity_conflict')
  if (String(lead.property_address || '').replace(/\s+/g, ' ').trim() !== request.propertyAddress) {
    stopReasons.push('property_identity_conflict')
  }
  if (
    target.property_address &&
    String(target.property_address).replace(/\s+/g, ' ').trim() !== request.propertyAddress
  ) {
    stopReasons.push('reply_memory_property_conflict')
  }
  if (stoppedStatus(lead.status) || stoppedStatus(lead.outreach_status) || stoppedStatus(lead.delivery_status)) {
    stopReasons.push('lead_stop_status')
  }
  if ((suppressionResult.data || []).length) stopReasons.push('active_suppression')
  if ((enrollmentResult.data || []).some((row) => {
    const outcomeAt = Date.parse(String(row.updated_at || ''))
    return String(row.status || '').toLowerCase() !== 'replied' ||
      !Number.isFinite(outcomeAt) ||
      outcomeAt > Date.parse(targetReceivedAt)
  })) stopReasons.push('prior_enrollment_stop_outcome')
  if ((sendEventResult.data || []).some((row) => {
    const outcomeAt = Date.parse(String(row.created_at || ''))
    return String(row.status || '').toLowerCase() !== 'replied' ||
      !Number.isFinite(outcomeAt) ||
      outcomeAt > Date.parse(targetReceivedAt)
  })) stopReasons.push('prior_delivery_stop_outcome')
  if ((newerReplies || []).length) stopReasons.push('newer_reply_received')
  if (
    target.id !== request.replyMemoryId ||
    target.lead_id !== request.leadId ||
    target.mailbox !== request.target.mailboxAddress ||
    target.thread_id !== request.target.conversationId ||
    target.message_id !== request.target.inboundImmutableMessageId ||
    String(target.from_email || '').trim().toLowerCase() !== request.recipientEmail ||
    String(target.to_email || '').trim().toLowerCase() !== request.target.mailboxAddress ||
    targetMetadata.internetMessageId !== request.target.inboundInternetMessageId
  ) {
    stopReasons.push('immutable_target_identity_conflict')
  }
  if (targetMetadata.explicitOptOut === true) stopReasons.push('explicit_opt_out')
  if (!hasExactGate3d1ReplyMemoryProvenance(targetMetadata, {
    tenantId: graphConfig.tenantId,
    mailboxObjectId: graphConfig.mailboxObjectId,
  })) {
    stopReasons.push('inbound_reader_provenance_conflict')
  }
  if (String(target.classification || '') !== 'hot_seller_lead') {
    stopReasons.push('target_not_positive_seller_reply')
  }
  if (!isConservativePositiveSellerReplyText({
    subject: target.subject,
    bodyPreview: target.reply_summary,
  })) {
    stopReasons.push('target_reply_content_not_conservatively_positive')
  }
  if (stopReasons.length) {
    throw new Error(`Gate 3D.1 ${phase} stop: ${Array.from(new Set(stopReasons)).join(', ')}.`)
  }

  const checkedAt = new Date().toISOString()
  return {
    suppressionSnapshot: {
      checkedAt,
      recipientHash: sha256(request.recipientEmail),
      suppressionCleared: true,
      evidenceKey: `gate3d1-graph-stop-preflight:${request.leadId}:${phase}:${checkedAt}`,
      provenance: {
        sourceTables: [
          'lead_suppressions',
          'leads',
          'outreach_send_events',
          'command_center_outbound_enrollments',
          'command_center_reply_memory',
        ],
        phase,
        activeSuppressions: 0,
        stopOutcomes: 0,
        newerReplies: 0,
      },
    },
    market: [lead.city, lead.state].filter(Boolean).join(', ') || null,
    propertyAddress: lead.property_address || null,
  }
}

function enrollmentBase(input: {
  request: Gate3d1GraphReplyRequest
  binding: OperatingStrategyBinding
  consentBasisSnapshot: Readonly<Record<string, unknown>>
  reservationId: string
  preflight: Gate3d1CanaryPreflight
  dispatchIntentAt: string
}) {
  return {
    strategyKey: input.binding.sourceIdentifier,
    channel: 'email' as const,
    messageId: input.request.outreachMessageId,
    recipient: input.request.recipientEmail,
    leadId: input.request.leadId,
    market: input.preflight.market,
    propertyAddress: input.preflight.propertyAddress,
    binding: input.binding,
    governedStage: 'dispatch_intent' as const,
    subjectNamespace: 'lead',
    subjectKey: input.request.leadId,
    dispatchIntentAt: input.dispatchIntentAt,
    dispatchReservationId: input.reservationId,
    dispatchChannel: 'outlook_graph',
    outreachPurpose: input.request.outreachPurpose,
    consentBasisSnapshot: input.consentBasisSnapshot,
    suppressionSnapshot: input.preflight.suppressionSnapshot,
    messageVersionKey: input.request.messageVersionKey,
    writerRelease: GATE3D1_WRITER_RELEASE,
  }
}

const dependencies: Gate3d1GraphReplyDependencies = {
  now: () => new Date(),
  assertActivation: assertExactCanaryActivation,
  getGraphSession,
  authorize: () => authorizeGate3d1CanaryDispatch(),
  assertNoStopSignal,
  claimAuthorization: async ({ request, binding }) => {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('claim_gate3d1_canary_dispatch', {
      p_authorization_id: request.authorizationId,
      p_exchange_rbac_attestation_id: request.exchangeRbacAttestationId,
      p_operating_strategy_version_id: binding.operatingStrategyVersionId,
      p_lead_id: request.leadId,
      p_channel: 'outlook_graph',
      p_approved_content_fingerprint: request.contentFingerprint,
      p_draft_version_key: request.messageVersionKey,
      p_reservation_idempotency_key: request.reservationIdempotencyKey,
      p_writer_release: GATE3D1_WRITER_RELEASE,
      p_idempotency_key: request.idempotencyKey,
    })
    if (error) throw new Error(`Gate 3D.1 one-shot claim failed closed: ${error.message}`)
    const row = rpcRows<{
      claim_id: string
      authorization_id: string
      exchange_rbac_attestation_id: string
      expires_at: string
      claim_fingerprint: string
      consent_basis_snapshot_json: Record<string, unknown>
    }>(data, 'Gate 3D.1 one-shot claim')
    if (
      row.authorization_id !== request.authorizationId ||
      row.exchange_rbac_attestation_id !== request.exchangeRbacAttestationId ||
      !Number.isFinite(Date.parse(row.expires_at)) ||
      Date.parse(row.expires_at) <= Date.now() ||
      !/^[0-9a-f]{32}$/.test(row.claim_fingerprint) ||
      !row.consent_basis_snapshot_json ||
      typeof row.consent_basis_snapshot_json !== 'object' ||
      Array.isArray(row.consent_basis_snapshot_json)
    ) {
      throw new Error('Gate 3D.1 claim returned incomplete or conflicting immutable evidence.')
    }
    return {
      claimId: exactUuid(row.claim_id, 'Gate 3D.1 claim ID'),
      authorizationId: row.authorization_id,
      exchangeRbacAttestationId: row.exchange_rbac_attestation_id,
      expiresAt: row.expires_at,
      claimFingerprint: row.claim_fingerprint,
      consentBasisSnapshot: row.consent_basis_snapshot_json,
    }
  },
  reserve: async (request, binding) => {
    const reservation = await reserveGate3d1CanaryDispatch({
      binding,
      idempotencyKey: request.reservationIdempotencyKey,
    })
    return { reservationId: reservation.reservationId }
  },
  bindReservation: async ({ request, binding, claim, reservation }) => {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('bind_gate3d1_canary_reservation', {
      p_claim_id: claim.claimId,
      p_reservation_id: reservation.reservationId,
      p_operating_strategy_version_id: binding.operatingStrategyVersionId,
      p_writer_release: GATE3D1_WRITER_RELEASE,
      p_idempotency_key: transitionIdempotency(request, 'reservation-bound'),
    })
    if (error) throw new Error(`Gate 3D.1 reservation binding failed closed: ${error.message}`)
    exactUuid(data, 'Gate 3D.1 reservation-binding event ID')
  },
  persistIntent: async ({ request, binding, claim, reservation, preflight, dispatchIntentAt }) => {
    const admin = createAdminClient()
    const { data: existingRows, error: existingError } = await admin
      .from('command_center_outbound_enrollments')
      .select('id,status,recipient,governed_stage,canonical_activity_id,dispatch_intent_at,dispatch_reservation_id,dispatch_channel,provider,provider_message_id,message_version_key,operating_strategy_version_id,operating_contract_fingerprint,consent_basis_snapshot_json,metadata_json')
      .eq('channel', 'email')
      .eq('last_message_id', request.outreachMessageId)
      .eq('operating_strategy_version_id', binding.operatingStrategyVersionId)
      .limit(2)
    if (existingError) throw existingError
    if ((existingRows || []).length > 1) {
      throw new Error('Gate 3D.1 found ambiguous existing dispatch intents; automatic retry is blocked.')
    }
    const existing = existingRows?.[0]
    if (existing) {
      const existingMetadata = (existing.metadata_json || {}) as Record<string, unknown>
      const existingThread = graphThreadFromMetadata(existing.metadata_json)
      if (
        existing.recipient !== request.recipientEmail ||
        existing.governed_stage !== 'dispatch_intent' ||
        !existing.canonical_activity_id ||
        existing.dispatch_reservation_id !== reservation.reservationId ||
        existing.dispatch_channel !== 'outlook_graph' ||
        existing.message_version_key !== request.messageVersionKey ||
        existing.operating_contract_fingerprint !== binding.contractFingerprint ||
        existingMetadata.authorizationId !== request.authorizationId ||
        existingMetadata.claimId !== claim.claimId ||
        existingMetadata.contentFingerprint !== request.contentFingerprint ||
        existingMetadata.threadFingerprint !== request.threadFingerprint ||
        existingMetadata.contractFingerprint !== request.contractFingerprint ||
        existingMetadata.idempotencyKey !== request.idempotencyKey ||
        !isDeepStrictEqual(existing.consent_basis_snapshot_json, claim.consentBasisSnapshot) ||
        !['queued', 'accepted'].includes(String(existing.status || ''))
      ) {
        throw new Error('The existing Gate 3D.1 dispatch intent conflicts with the immutable canary manifest.')
      }
      if (
        existingThread
          ? existing.provider !== 'outlook_graph' ||
            existing.provider_message_id !== existingThread.outboundImmutableMessageId
          : (existing.provider !== null && existing.provider !== 'outlook_graph') ||
            Boolean(existing.provider_message_id)
      ) {
        throw new Error('The existing Graph provider identity conflicts with its immutable thread evidence.')
      }
      return {
        enrollmentId: existing.id,
        canonicalActivityId: exactUuid(existing.canonical_activity_id, 'Existing canonical activity ID'),
        dispatchIntentAt: existing.dispatch_intent_at,
        existingThread,
      }
    }
    const enrollment = await recordOutboundEnrollment({
      ...enrollmentBase({
        request,
        binding,
        consentBasisSnapshot: claim.consentBasisSnapshot,
        reservationId: reservation.reservationId,
        preflight,
        dispatchIntentAt,
      }),
      status: 'queued',
      provider: 'outlook_graph',
      metadata: {
        deliveryMode: 'gate3d1_exact_same_thread_canary',
        approvalManifestKey: request.approvalManifestKey,
        authorizationId: request.authorizationId,
        claimId: claim.claimId,
        contentFingerprint: request.contentFingerprint,
        threadFingerprint: request.threadFingerprint,
        contractFingerprint: request.contractFingerprint,
        idempotencyKey: request.idempotencyKey,
        graphReplyTarget: {
          idType: 'restImmutableEntryId',
          mailboxObjectId: request.target.mailboxObjectId,
          mailboxAddress: request.target.mailboxAddress,
          recipientEmail: request.recipientEmail,
          targetInboundImmutableMessageId: request.target.inboundImmutableMessageId,
          targetConversationId: request.target.conversationId,
          targetInternetMessageId: request.target.inboundInternetMessageId,
        },
      },
    })
    return {
      enrollmentId: enrollment.id,
      canonicalActivityId: exactUuid(enrollment.canonical_activity_id, 'Canonical enrollment activity ID'),
      dispatchIntentAt,
    }
  },
  confirmIntent: async ({ request, claim, reservation, intent }) => {
    let recovery = await getGate3d1DispatchState({ request, claimId: claim.claimId })
    if (recovery.dispatch_state === 'reservation_bound') {
      const admin = createAdminClient()
      const { data, error } = await admin.rpc('confirm_gate3d1_canary_dispatch_intent', {
        p_claim_id: claim.claimId,
        p_reservation_id: reservation.reservationId,
        p_outbound_enrollment_id: intent.enrollmentId,
        p_canonical_activity_id: intent.canonicalActivityId,
        p_approved_content_fingerprint: request.contentFingerprint,
        p_draft_version_key: request.messageVersionKey,
        p_writer_release: GATE3D1_WRITER_RELEASE,
        p_idempotency_key: transitionIdempotency(request, 'intent-ready'),
      })
      if (error) throw new Error(`Gate 3D.1 canonical intent confirmation failed closed: ${error.message}`)
      exactUuid(data, 'Gate 3D.1 intent-ready event ID')
      recovery = await getGate3d1DispatchState({ request, claimId: claim.claimId })
    }

    const stateMap = {
      intent_ready: 'intent_confirmed',
      graph_draft_attempted: 'draft_attempted',
      graph_draft_created: 'draft_created',
      send_attempted: 'send_attempted',
      accepted: 'accepted',
      ambiguous: 'ambiguous',
      reconciled_accepted: 'reconciled_accepted',
      reconciled_not_sent: 'reconciled_not_sent',
      dead_lettered: 'dead_lettered',
    } as const
    const state = stateMap[recovery.dispatch_state as keyof typeof stateMap]
    if (!state) {
      throw new Error(`Gate 3D.1 cannot continue from ${recovery.dispatch_state || 'unknown'} state.`)
    }
    if (
      recovery.reservation_id !== reservation.reservationId ||
      recovery.outbound_enrollment_id !== intent.enrollmentId ||
      recovery.canonical_activity_id !== intent.canonicalActivityId
    ) {
      throw new Error('Gate 3D.1 recovery state conflicts with the exact reservation or canonical intent identity.')
    }
    const thread = intent.existingThread || null
    const providerHashes = [
      recovery.provider_draft_id_hash,
      recovery.provider_conversation_id_hash,
      recovery.provider_internet_message_id_hash,
    ]
    if (providerHashes.some(Boolean)) {
      if (
        !thread ||
        recovery.provider_draft_id_hash !== sha256(thread.outboundImmutableMessageId) ||
        recovery.provider_conversation_id_hash !== sha256(thread.targetConversationId) ||
        recovery.provider_internet_message_id_hash !== sha256(thread.outboundInternetMessageId)
      ) {
        throw new Error('Gate 3D.1 recovery hashes conflict with the persisted immutable Graph thread.')
      }
    }
    const expectedAutomaticRetry = state === 'intent_confirmed' || state === 'draft_created'
    if (recovery.automatic_provider_retry_allowed !== expectedAutomaticRetry) {
      throw new Error('Gate 3D.1 recovery state returned an unsafe automatic-provider retry decision.')
    }
    if (
      ['send_attempted', 'accepted', 'ambiguous', 'reconciled_accepted', 'reconciled_not_sent', 'dead_lettered'].includes(state) &&
      (!recovery.global_stop_engaged || !recovery.strategy_stop_engaged)
    ) {
      throw new Error('Gate 3D.1 terminal or uncertain provider state is not protected by both outbound stops.')
    }
    return { ...intent, claimId: claim.claimId, state }
  },
  assertProviderMutationAllowed: async ({ request, binding, claim, reservation, mutation }) => {
    const authorization = await assertGate3d1ProviderDispatch({
      request,
      binding,
      claimId: claim.claimId,
      reservationId: reservation.reservationId,
    })
    const expectedState = mutation === 'create_reply' ? 'intent_ready' : 'graph_draft_created'
    if (authorization.dispatch_state !== expectedState) {
      throw new Error(`Gate 3D.1 ${mutation} requires exact ${expectedState} state.`)
    }
  },
  beginDraftAttempt: async ({ request, binding, claim, reservation }) => {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('begin_gate3d1_canary_graph_draft_attempt', {
      p_claim_id: claim.claimId,
      p_reservation_id: reservation.reservationId,
      p_operating_strategy_version_id: binding.operatingStrategyVersionId,
      p_writer_release: GATE3D1_WRITER_RELEASE,
      p_idempotency_key: transitionIdempotency(request, 'graph-draft-attempt'),
    })
    if (error) throw new Error(`Gate 3D.1 Graph draft permit failed closed: ${error.message}`)
    const row = rpcRows<{
      claim_id: string
      provider_mutation_permit_fingerprint: string
      expires_at: string
      mailbox_address: string
      inbound_message_id: string
      inbound_conversation_id: string
      inbound_internet_message_id: string
    }>(data, 'Gate 3D.1 Graph draft permit')
    if (
      row.claim_id !== claim.claimId ||
      !/^[0-9a-f]{64}$/.test(row.provider_mutation_permit_fingerprint) ||
      !Number.isFinite(Date.parse(row.expires_at)) ||
      Date.parse(row.expires_at) <= Date.now() ||
      row.mailbox_address !== request.target.mailboxAddress ||
      row.inbound_message_id !== request.target.inboundImmutableMessageId ||
      row.inbound_conversation_id !== request.target.conversationId ||
      row.inbound_internet_message_id !== request.target.inboundInternetMessageId
    ) {
      throw new Error('Gate 3D.1 Graph draft permit conflicts with the exact immutable target.')
    }
  },
  getTargetMessage: async (session, target) => graphMessageIdentity(await graphJson({
    session,
    path: `/users/${encodeURIComponent(target.mailboxObjectId)}/messages/${encodeURIComponent(target.inboundImmutableMessageId)}?$select=id,conversationId,internetMessageId,from,toRecipients,ccRecipients,bccRecipients,isDraft`,
    expectedStatus: 200,
  })),
  getOutboundMessage: async (session, target, outboundImmutableMessageId) => graphMessageIdentity(await graphJson({
    session,
    path: `/users/${encodeURIComponent(target.mailboxObjectId)}/messages/${encodeURIComponent(outboundImmutableMessageId)}?$select=id,conversationId,internetMessageId,from,toRecipients,ccRecipients,bccRecipients,isDraft,sentDateTime`,
    expectedStatus: 200,
  })),
  createReplyDraft: async (session, request) => graphMessageIdentity(await graphJson({
    session,
    path: `/users/${encodeURIComponent(request.target.mailboxObjectId)}/messages/${encodeURIComponent(request.target.inboundImmutableMessageId)}/createReply`,
    method: 'POST',
    body: { comment: request.comment },
    expectedStatus: 201,
  })),
  persistDraftIdentity: async ({ request, binding, claim, reservation, preflight, intent, dispatchIntentAt, thread }) => {
    await recordOutboundEnrollment({
      ...enrollmentBase({
        request,
        binding,
        consentBasisSnapshot: claim.consentBasisSnapshot,
        reservationId: reservation.reservationId,
        preflight,
        dispatchIntentAt,
      }),
      enrollmentId: intent.enrollmentId,
      status: 'queued',
      provider: 'outlook_graph',
      providerMessageId: thread.outboundImmutableMessageId,
      metadata: {
        deliveryMode: 'gate3d1_exact_same_thread_canary',
        approvalManifestKey: request.approvalManifestKey,
        authorizationId: request.authorizationId,
        claimId: claim.claimId,
        contentFingerprint: request.contentFingerprint,
        threadFingerprint: request.threadFingerprint,
        contractFingerprint: request.contractFingerprint,
        idempotencyKey: request.idempotencyKey,
        graphReplyThread: graphThreadMetadata(thread),
        providerStage: 'reply_draft_created_unsent',
      },
    })
  },
  recordDraftResult: async ({ request, claim, reservation, outcome, thread, errorCode }) => {
    const admin = createAdminClient()
    const providerOutcome = outcome === 'draft_created' ? 'graph_draft_created' : 'ambiguous'
    const evidenceFingerprint = sha256Evidence({
      provider: 'outlook_graph',
      outcome: providerOutcome,
      claimId: claim.claimId,
      reservationId: reservation.reservationId,
      thread: thread ? graphThreadMetadata(thread) : null,
      errorCode: errorCode || null,
    })
    const { data, error } = await admin.rpc('record_gate3d1_canary_graph_draft_result', {
      p_claim_id: claim.claimId,
      p_reservation_id: reservation.reservationId,
      p_outcome: providerOutcome,
      p_provider_draft_id_hash: thread ? sha256(thread.outboundImmutableMessageId) : null,
      p_provider_conversation_id_hash: thread ? sha256(thread.targetConversationId) : null,
      p_provider_internet_message_id_hash: thread ? sha256(thread.outboundInternetMessageId) : null,
      p_provider_evidence_fingerprint: evidenceFingerprint,
      p_writer_release: GATE3D1_WRITER_RELEASE,
      p_idempotency_key: transitionIdempotency(request, `graph-draft-result:${providerOutcome}`),
    })
    if (error) throw new Error(`Gate 3D.1 Graph draft result failed closed: ${error.message}`)
    exactUuid(data, 'Gate 3D.1 Graph draft-result event ID')
  },
  beginSendAttempt: async ({ request, binding, claim, reservation, thread }) => {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('begin_gate3d1_canary_send_attempt', {
      p_claim_id: claim.claimId,
      p_reservation_id: reservation.reservationId,
      p_operating_strategy_version_id: binding.operatingStrategyVersionId,
      p_writer_release: GATE3D1_WRITER_RELEASE,
      p_idempotency_key: transitionIdempotency(request, 'send-attempt'),
    })
    if (error) throw new Error(`Gate 3D.1 one-shot send permit failed closed: ${error.message}`)
    const row = rpcRows<{
      claim_id: string
      provider_mutation_permit_fingerprint: string
      provider_draft_id_hash: string
      expires_at: string
    }>(data, 'Gate 3D.1 one-shot send permit')
    if (
      row.claim_id !== claim.claimId ||
      !/^[0-9a-f]{64}$/.test(row.provider_mutation_permit_fingerprint) ||
      row.provider_draft_id_hash !== sha256(thread.outboundImmutableMessageId) ||
      !Number.isFinite(Date.parse(row.expires_at)) ||
      Date.parse(row.expires_at) <= Date.now()
    ) {
      throw new Error('Gate 3D.1 one-shot send permit conflicts with the exact persisted Graph draft.')
    }
  },
  sendReplyDraft: async (session, target, outboundImmutableMessageId) => graphAccepted({
    session,
    path: `/users/${encodeURIComponent(target.mailboxObjectId)}/messages/${encodeURIComponent(outboundImmutableMessageId)}/send`,
  }),
  persistAccepted: async ({ request, binding, claim, reservation, preflight, intent, dispatchIntentAt, acceptedAt, thread }) => {
    await recordOutboundEnrollment({
      ...enrollmentBase({
        request,
        binding,
        consentBasisSnapshot: claim.consentBasisSnapshot,
        reservationId: reservation.reservationId,
        preflight,
        dispatchIntentAt,
      }),
      enrollmentId: intent.enrollmentId,
      status: 'accepted',
      provider: 'outlook_graph',
      providerMessageId: thread.outboundImmutableMessageId,
      metadata: {
        deliveryMode: 'gate3d1_exact_same_thread_canary',
        approvalManifestKey: request.approvalManifestKey,
        authorizationId: request.authorizationId,
        claimId: claim.claimId,
        contentFingerprint: request.contentFingerprint,
        threadFingerprint: request.threadFingerprint,
        contractFingerprint: request.contractFingerprint,
        idempotencyKey: request.idempotencyKey,
        graphReplyThread: graphThreadMetadata(thread),
        providerStage: 'accepted',
        providerResultAt: acceptedAt,
      },
    })
    const outcome = await recordStrategyDeliveryOutcome({
      leadId: request.leadId,
      subjectNamespace: 'lead',
      subjectKey: request.leadId,
      messageId: request.outreachMessageId,
      enrollmentId: intent.enrollmentId,
      operatingStrategyVersionId: binding.operatingStrategyVersionId,
      provider: 'outlook_graph',
      providerMessageId: thread.outboundImmutableMessageId,
      evidenceId: `gate3d1-graph-reply:${thread.outboundImmutableMessageId}:accepted`,
      status: 'accepted',
      occurredAt: acceptedAt,
    })
    if (!outcome.updated) {
      throw new Error(`Graph canary delivery attribution failed: ${outcome.reason}.`)
    }
  },
  recordSendResult: async ({ request, claim, reservation, outcome, thread, acceptedAt, errorCode }) => {
    const admin = createAdminClient()
    const evidenceFingerprint = sha256Evidence({
      provider: 'outlook_graph',
      outcome,
      claimId: claim.claimId,
      reservationId: reservation.reservationId,
      thread: graphThreadMetadata(thread),
      acceptedAt: acceptedAt || null,
      errorCode: errorCode || null,
    })
    const { data, error } = await admin.rpc('record_gate3d1_canary_send_result', {
      p_claim_id: claim.claimId,
      p_reservation_id: reservation.reservationId,
      p_outcome: outcome,
      p_provider_evidence_fingerprint: evidenceFingerprint,
      p_writer_release: GATE3D1_WRITER_RELEASE,
      p_idempotency_key: transitionIdempotency(request, `send-result:${outcome}`),
    })
    if (error) throw new Error(`Gate 3D.1 send-result transition failed closed: ${error.message}`)
    exactUuid(data, 'Gate 3D.1 send-result event ID')
  },
  ensureStopsEngaged: async ({ request, binding, phase }) => {
    const admin = createAdminClient()
    const evidenceFingerprint = sha256Evidence({
      provider: 'outlook_graph',
      phase,
      operatingStrategyVersionId: binding.operatingStrategyVersionId,
      contentFingerprint: request.contentFingerprint,
      threadFingerprint: request.threadFingerprint,
    })
    const { data, error } = await admin.rpc('engage_gate3d1_canary_stop', {
      p_operating_strategy_version_id: binding.operatingStrategyVersionId,
      p_writer_release: GATE3D1_WRITER_RELEASE,
      p_reason: `Gate 3D.1 terminal ${phase} stops verified.`,
      p_evidence_fingerprint: evidenceFingerprint,
      p_idempotency_key: transitionIdempotency(request, `terminal-stop:${phase}`),
    })
    if (error) throw new Error(`Gate 3D.1 terminal stops could not be confirmed: ${error.message}`)
    const result = data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown>
      : null
    if (
      !result ||
      result.operatingStrategyVersionId !== binding.operatingStrategyVersionId ||
      result.blocked !== true ||
      result.evidenceFingerprint !== evidenceFingerprint
    ) {
      throw new Error('Gate 3D.1 terminal stop confirmation returned conflicting evidence.')
    }
  },
  failClosed: async ({ request, claim, reservation, intent, thread, failurePhase }) => {
    const admin = createAdminClient()
    const evidenceFingerprint = sha256Evidence({
      provider: 'outlook_graph',
      failurePhase,
      authorizationId: request.authorizationId,
      claimId: claim?.claimId || null,
      reservationId: reservation?.reservationId || null,
      enrollmentId: intent?.enrollmentId || null,
      contentFingerprint: request.contentFingerprint,
      threadFingerprint: request.threadFingerprint,
      outboundImmutableMessageIdHash: thread
        ? sha256(thread.outboundImmutableMessageId)
        : null,
    })
    const reason = `Gate 3D.1 execution stopped safely during ${failurePhase}.`
    if (claim?.claimId) {
      const { data: abortData, error: abortError } = await admin.rpc(
        'abort_gate3d1_canary_before_send',
        {
          p_claim_id: claim.claimId,
          p_reason: reason,
          p_provider_evidence_fingerprint: evidenceFingerprint,
          p_writer_release: GATE3D1_WRITER_RELEASE,
          p_idempotency_key: transitionIdempotency(request, `abort:${failurePhase}`),
        }
      )
      if (!abortError) {
        exactUuid(abortData, 'Gate 3D.1 pre-send abort event ID')
        return
      }
    }
    const { data, error } = await admin.rpc('engage_gate3d1_canary_stop', {
      p_operating_strategy_version_id: request.operatingStrategyVersionId,
      p_writer_release: GATE3D1_WRITER_RELEASE,
      p_reason: reason,
      p_evidence_fingerprint: evidenceFingerprint,
      p_idempotency_key: transitionIdempotency(request, `stop:${failurePhase}`),
    })
    if (error) throw new Error(`Gate 3D.1 emergency stop could not be confirmed: ${error.message}`)
    const result = data && typeof data === 'object' && !Array.isArray(data)
      ? data as Record<string, unknown>
      : null
    if (
      !result ||
      result.operatingStrategyVersionId !== request.operatingStrategyVersionId ||
      result.blocked !== true ||
      result.evidenceFingerprint !== evidenceFingerprint
    ) {
      throw new Error('Gate 3D.1 emergency stop returned incomplete or conflicting evidence.')
    }
  },
}

export async function resolveGate3d1GraphReplyExecutionRequest(input: {
  authorizationId: string
  outreachMessageId: string
  idempotencyKey: string
}) {
  const authorizationId = exactUuid(input.authorizationId, 'Gate 3D.1 authorization ID')
  const outreachMessageId = exactUuid(input.outreachMessageId, 'Gate 3D.1 outreach message ID')
  const config = dedicatedGraphConfig()
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('resolve_gate3d1_canary_execution_manifest', {
    p_authorization_id: authorizationId,
    p_outreach_message_id: outreachMessageId,
    p_writer_release: GATE3D1_WRITER_RELEASE,
  })
  if (error) throw new Error(`Gate 3D.1 execution manifest failed closed: ${error.message}`)
  const manifest = rpcRows<{
    authorization_id: string
    exchange_rbac_attestation_id: string
    reply_memory_id: string
    lead_id: string
    outreach_message_id: string
    recipient_email: string
    property_reference_key: string
    local_timezone: string
    allowed_local_start: string
    allowed_local_end: string
    allowed_iso_weekdays: number[]
    tenant_id: string
    client_id: string
    mailbox_object_id: string
    mailbox_address: string
    inbound_message_id: string
    inbound_conversation_id: string
    inbound_internet_message_id: string
    approved_subject: string | null
    approved_comment: string
    draft_version_key: string
    approved_content_fingerprint: string
    operating_strategy_version_id: string
    operating_contract_fingerprint: string
    authorization_expires_at: string
  }>(data, 'Gate 3D.1 execution manifest')
  const comment = String(manifest.approved_comment || '')
  if (
    manifest.authorization_id !== authorizationId ||
    manifest.outreach_message_id !== outreachMessageId ||
    manifest.tenant_id !== config.tenantId ||
    manifest.client_id !== config.clientId ||
    manifest.mailbox_object_id !== config.mailboxObjectId ||
    String(manifest.mailbox_address || '').trim().toLowerCase() !== config.mailboxAddress ||
    manifest.local_timezone.length < 3 ||
    !String(manifest.allowed_local_start).startsWith('10:30') ||
    !String(manifest.allowed_local_end).startsWith('16:30') ||
    !isDeepStrictEqual((manifest.allowed_iso_weekdays || []).map(Number), [1, 2, 3, 4, 5]) ||
    comment !== comment.trim() ||
    fingerprintGate3d1GraphReplyContent({
      outreachMessageId,
      sourceIdentifier: 'seller_options_intake',
      outreachPurpose: 'seller_reply_followup',
      messageVersionKey: manifest.draft_version_key,
      comment,
    }) !== manifest.approved_content_fingerprint ||
    !Number.isFinite(Date.parse(manifest.authorization_expires_at)) ||
    Date.parse(manifest.authorization_expires_at) <= Date.now()
  ) {
    throw new Error('Gate 3D.1 execution manifest returned stale or conflicting immutable evidence.')
  }
  const requestBase = {
    leadId: exactUuid(manifest.lead_id, 'Manifest lead ID'),
    replyMemoryId: exactUuid(manifest.reply_memory_id, 'Manifest reply-memory ID'),
    outreachMessageId,
    recipientEmail: String(manifest.recipient_email || '').trim().toLowerCase(),
    recipientTimeZone: manifest.local_timezone,
    propertyAddress: String(manifest.property_reference_key || '').replace(/\s+/g, ' ').trim(),
    sourceNamespace: 'operating_strategy' as const,
    sourceIdentifier: 'seller_options_intake',
    operatingStrategyVersionId: exactUuid(
      manifest.operating_strategy_version_id,
      'Manifest operating strategy version ID'
    ),
    outreachPurpose: 'seller_reply_followup',
    messageVersionKey: manifest.draft_version_key,
    authorizationId,
    exchangeRbacAttestationId: exactUuid(
      manifest.exchange_rbac_attestation_id,
      'Manifest RBAC attestation ID'
    ),
    approvalManifestKey: GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY,
    contentFingerprint: manifest.approved_content_fingerprint,
    contractFingerprint: manifest.operating_contract_fingerprint,
    reservationIdempotencyKey: `${input.idempotencyKey}:reservation`,
    idempotencyKey: input.idempotencyKey,
    comment,
    target: {
      mailboxObjectId: manifest.mailbox_object_id,
      mailboxAddress: manifest.mailbox_address,
      inboundImmutableMessageId: manifest.inbound_message_id,
      conversationId: manifest.inbound_conversation_id,
      inboundInternetMessageId: manifest.inbound_internet_message_id,
    },
  }
  return {
    ...requestBase,
    threadFingerprint: fingerprintGate3d1GraphReplyThread(requestBase),
  } satisfies Gate3d1GraphReplyRequest
}

export async function getGate3d1GraphReplyCanaryReadiness() {
  const config = dedicatedGraphConfig()
  const callbackScope = getConfiguredGate3d1InboundMailboxScope()
  let rbacAttestation: {
    current: boolean
    attestationId: string | null
    expiresAt: string | null
    blocker: string | null
  } = {
    current: false,
    attestationId: null,
    expiresAt: null,
    blocker: 'Dedicated Graph sender identity is incomplete.',
  }
  if (
    config.tenantId &&
    config.clientId &&
    config.mailboxObjectId &&
    config.mailboxAddress
  ) {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('assert_gate3d1_graph_rbac_attestation_current', {
      p_tenant_id: config.tenantId,
      p_client_id: config.clientId,
      p_mailbox_object_id: config.mailboxObjectId,
      p_mailbox_address: config.mailboxAddress,
    })
    if (error) {
      rbacAttestation = {
        current: false,
        attestationId: null,
        expiresAt: null,
        blocker: 'Founder-reviewed Exchange Application RBAC attestation is unavailable or expired.',
      }
    } else {
      const row = rpcRows<{
        attestation_id: string
        expires_at: string
      }>(data, 'Gate 3D.1 readiness RBAC attestation')
      rbacAttestation = {
        current: true,
        attestationId: exactUuid(row.attestation_id, 'Gate 3D.1 readiness attestation ID'),
        expiresAt: row.expires_at,
        blocker: null,
      }
    }
  }
  return {
    configured: Boolean(
      config.tenantId &&
      config.clientId &&
      config.clientSecret &&
      config.mailboxObjectId &&
      config.mailboxAddress
    ),
    authMode: 'application_credentials' as const,
    mailbox: config.mailboxAddress || null,
    tenantIdConfigured: Boolean(config.tenantId),
    clientIdConfigured: Boolean(config.clientId),
    clientSecretConfigured: Boolean(config.clientSecret),
    mailboxObjectIdConfigured: Boolean(config.mailboxObjectId),
    enabled: exactEnv('GATE3D1_GRAPH_REPLY_CANARY_ENABLED') === 'true',
    oneRecipientPinned: /^[0-9a-f]{64}$/.test(exactEnv('GATE3D1_GRAPH_REPLY_CANARY_RECIPIENT_SHA256')),
    capIsOne: exactEnv('GATE3D1_GRAPH_REPLY_CANARY_MAX_SENDS') === '1',
    founderManifestPinned:
      exactEnv('GATE3D1_GRAPH_REPLY_CANARY_APPROVAL_MANIFEST_KEY') ===
      GATE3D1_SELLER_REPLY_CANARY_MANIFEST_KEY,
    dedicatedActivationOnly: true,
    legacyGlobalLiveSendRequired: false,
    inboundCallbackScope: {
      ready: callbackScope.ready,
      blocker: callbackScope.blocker,
    },
    rbacAttestation,
    providerFallback: false,
  }
}

// Intentionally not attached to an API route, cron, n8n workflow, or command.
// A later activation gate must construct the immutable manifest and call this
// function explicitly for the one pinned recipient.
export async function executeGate3d1GraphSameThreadReplyCanary(
  request: Gate3d1GraphReplyRequest
) {
  return runGate3d1GraphSameThreadReplyCanary(request, dependencies)
}

export type {
  Gate3d1GraphReplyRequest,
  Gate3d1GraphReplyTarget,
}
