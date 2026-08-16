import 'server-only'

import { createHash } from 'node:crypto'

import {
  buildGate3d1CompliantReplyComment,
  executeGate3d1GraphSameThreadReplyCanary,
  getGate3d1GraphReplyCanaryReadiness,
  hasExactGate3d1ComplianceFooter,
  resolveGate3d1GraphReplyExecutionRequest,
} from '@/lib/email/graphSameThreadReplyCanary'
import {
  fingerprintGate3d1GraphReplyContent,
  hasExactGate3d1ReplyMemoryProvenance,
  isConservativePositiveSellerReplyText,
  resolveGate3d1ExecutionOrStop,
  selectExactGate3d1LocalDraft,
} from '@/lib/email/graphSameThreadReplyCore'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServer } from '@/lib/supabase/server'
import {
  GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT,
  GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
} from '@/lib/strategy/gate3d1-seller-reply-canary'

const GATE3D1_GENERATOR = GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE
const GATE3D1_PURPOSE = 'seller_reply_followup'
const GATE3D1_LOCAL_START = '10:30:00'
const GATE3D1_LOCAL_END = '16:30:00'
const GATE3D1_ISO_WEEKDAYS = [1, 2, 3, 4, 5] as const
const GATE3D1_FOUNDER_USER_ID = 'db0e9822-637b-4038-bc18-2a4b020cedce'
const GATE3D1_FOUNDER_EMAIL = 'contact@vestblock.io'
const GATE3D1_ACTIVATION_PROPOSER_KEY = 'gate3d1_activation_proposer_v1'
const GATE3D1_ACTIVATION_REVIEWER_KEY = 'gate3d1_founder_activation_reviewer_v1'

type RpcError = { message: string } | null
type UserScopedRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: RpcError }>
}

function userScopedRpcClient() {
  return getSupabaseServer() as unknown as UserScopedRpcClient
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function exactEnv(name: string) {
  return String(process.env[name] || '').trim()
}

function dedicatedGraphConfig() {
  return {
    tenantId: exactEnv('GATE3D1_GRAPH_TENANT_ID'),
    clientId: exactEnv('GATE3D1_GRAPH_CLIENT_ID'),
    clientSecretConfigured: Boolean(exactEnv('GATE3D1_GRAPH_CLIENT_SECRET')),
    mailboxObjectId: exactEnv('GATE3D1_GRAPH_MAILBOX_OBJECT_ID'),
    mailboxAddress: exactEnv('GATE3D1_GRAPH_MAILBOX_ADDRESS').toLowerCase(),
  }
}

function exactUuid(value: unknown, label: string) {
  const normalized = String(value || '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`${label} must be an exact UUID.`)
  }
  return normalized
}

function exactSha256(value: unknown, label: string) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`${label} must be an exact SHA-256 fingerprint.`)
  }
  return normalized
}

function exactGateKey(value: unknown, label: string) {
  const normalized = String(value || '').trim()
  if (!/^[a-z0-9][a-z0-9_.:-]{2,127}$/.test(normalized)) {
    throw new Error(`${label} must use the exact Gate 3D.1 key format.`)
  }
  return normalized
}

function assertIanaTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0))
  } catch {
    throw new Error('Recipient time zone must be an exact IANA identifier.')
  }
}

async function founderRpc(
  functionName: string,
  args: Record<string, unknown>,
  label: string
) {
  const { data, error } = await userScopedRpcClient().rpc(functionName, args)
  if (error) throw new Error(`${label} failed closed: ${error.message}`)
  return data
}

export function isExactGate3d1FounderIdentity(input: {
  id: string
  email?: string | null
}) {
  return input.id === GATE3D1_FOUNDER_USER_ID &&
    String(input.email || '').trim().toLowerCase() === GATE3D1_FOUNDER_EMAIL
}

export async function assertGate3d1FounderActor(actorUserId: string) {
  const exactActor = exactUuid(actorUserId, 'Founder actor ID')
  const asserted = exactUuid(await founderRpc(
    'assert_gate3d1_founder_actor',
    { p_actor_user_id: exactActor },
    'Gate 3D.1 founder assertion'
  ), 'Asserted Gate 3D.1 founder actor ID')
  if (asserted !== exactActor || asserted !== GATE3D1_FOUNDER_USER_ID) {
    throw new Error('Gate 3D.1 founder assertion returned a different actor identity.')
  }
  return asserted
}

export async function bootstrapGate3d1FounderReviewer(input: {
  actorUserId: string
  idempotencyKey: string
}) {
  const exactActor = exactUuid(input.actorUserId, 'Founder actor ID')
  const bootstrapIdempotencyKey = exactGateKey(
    input.idempotencyKey,
    'Founder-bootstrap idempotency key'
  )
  if (exactActor !== GATE3D1_FOUNDER_USER_ID) {
    throw new Error('Only the exact verified VestBlock founder may bootstrap Gate 3D.1.')
  }
  const bootstrapped = exactUuid(await founderRpc(
    'bootstrap_gate3d1_founder_reviewer',
    { p_actor_user_id: exactActor },
    'Gate 3D.1 founder bootstrap'
  ), 'Bootstrapped Gate 3D.1 founder actor ID')
  if (bootstrapped !== exactActor) {
    throw new Error('Gate 3D.1 founder bootstrap returned a different actor identity.')
  }
  return {
    founderUserId: bootstrapped,
    authorityRole: 'founder_reviewer' as const,
    idempotencyKey: bootstrapIdempotencyKey,
    providerMutation: false as const,
  }
}

type ExactReplyEvidence = {
  lead: Record<string, unknown>
  reply: Record<string, unknown>
  message: Record<string, unknown>
  version: Record<string, unknown>
  strategy: Record<string, unknown>
}

async function loadExactReplyEvidence(input: {
  replyMemoryId: string
  outreachMessageId: string
  operatingStrategyVersionId: string
  actorUserId: string
}): Promise<ExactReplyEvidence> {
  const admin = createAdminClient()
  const [replyResult, messageResult, versionResult] = await Promise.all([
    admin
      .from('command_center_reply_memory')
      .select('id,lead_id,mailbox,thread_id,message_id,from_email,to_email,subject,reply_summary,property_address,received_at,classification,metadata_json')
      .eq('id', input.replyMemoryId)
      .limit(2),
    admin
      .from('outreach_messages')
      .select('id,lead_id,channel,subject,body,variant_key,status,approved_at,approved_by_user_id,sent_at,generated_with')
      .eq('id', input.outreachMessageId)
      .limit(2),
    admin
      .from('operating_strategy_versions')
      .select('id,operating_strategy_id,status,execution_mode,external_send_cap,approved_by_user_id')
      .eq('id', input.operatingStrategyVersionId)
      .limit(2),
  ])
  for (const result of [replyResult, messageResult, versionResult]) {
    if (result.error) throw new Error(`Gate 3D.1 evidence lookup failed closed: ${result.error.message}`)
  }
  if (
    (replyResult.data || []).length !== 1 ||
    (messageResult.data || []).length !== 1 ||
    (versionResult.data || []).length !== 1
  ) {
    throw new Error('Gate 3D.1 requires exactly one reply, authored message, and operating version.')
  }
  const reply = replyResult.data![0] as Record<string, unknown>
  const message = messageResult.data![0] as Record<string, unknown>
  const version = versionResult.data![0] as Record<string, unknown>
  const [leadResult, strategyResult] = await Promise.all([
    admin
      .from('leads')
      .select('id,email,property_address,status,outreach_status,delivery_status')
      .eq('id', String(message.lead_id || ''))
      .limit(2),
    admin
      .from('operating_strategies')
      .select('id,strategy_key')
      .eq('id', String(version.operating_strategy_id || ''))
      .limit(2),
  ])
  if (leadResult.error || strategyResult.error) {
    throw new Error('Gate 3D.1 lead or strategy evidence is temporarily unavailable.')
  }
  if ((leadResult.data || []).length !== 1 || (strategyResult.data || []).length !== 1) {
    throw new Error('Gate 3D.1 requires one exact lead and seller strategy.')
  }
  const lead = leadResult.data![0] as Record<string, unknown>
  const strategy = strategyResult.data![0] as Record<string, unknown>
  const config = dedicatedGraphConfig()
  const metadata = reply.metadata_json && typeof reply.metadata_json === 'object'
    ? reply.metadata_json as Record<string, unknown>
    : {}
  const recipient = String(reply.from_email || '').trim().toLowerCase()
  const property = String(lead.property_address || '').replace(/\s+/g, ' ').trim()
  const replyProperty = String(reply.property_address || '').replace(/\s+/g, ' ').trim()
  const messageBody = String(message.body || '')
  const messageVersionKey = exactGateKey(message.variant_key, 'Authored message version')
  if (
    !config.tenantId ||
    !config.clientId ||
    !config.clientSecretConfigured ||
    !config.mailboxObjectId ||
    !config.mailboxAddress
  ) {
    throw new Error('All five dedicated Gate 3D.1 Graph sender settings are required.')
  }
  if (
    String(strategy.strategy_key || '') !== 'seller_options_intake' ||
    String(version.status || '') !== 'active' ||
    String(version.execution_mode || '') !== 'approved_live' ||
    Number(version.external_send_cap) !== 1 ||
    String(version.approved_by_user_id || '') !== input.actorUserId ||
    String(message.lead_id || '') !== String(reply.lead_id || '') ||
    String(lead.id || '') !== String(reply.lead_id || '') ||
    String(message.channel || '') !== 'email' ||
    String(message.generated_with || '') !== GATE3D1_GENERATOR ||
    Boolean(message.sent_at) ||
    !['needs_review', 'approved'].includes(String(message.status || '')) ||
    (String(message.status || '') === 'approved' &&
      String(message.approved_by_user_id || '') !== input.actorUserId) ||
    !messageBody ||
    messageBody !== messageBody.trim() ||
    !hasExactGate3d1ComplianceFooter(messageBody) ||
    String(reply.classification || '') !== 'hot_seller_lead' ||
    !isConservativePositiveSellerReplyText({
      subject: String(reply.subject || ''),
      bodyPreview: String(reply.reply_summary || ''),
    }) ||
    metadata.explicitOptOut === true ||
    !hasExactGate3d1ReplyMemoryProvenance(metadata, {
      tenantId: config.tenantId,
      mailboxObjectId: config.mailboxObjectId,
    }) ||
    String(reply.mailbox || '').trim().toLowerCase() !== config.mailboxAddress ||
    String(reply.to_email || '').trim().toLowerCase() !== config.mailboxAddress ||
    String(lead.email || '').trim().toLowerCase() !== recipient ||
    !recipient ||
    !property ||
    (replyProperty && replyProperty !== property) ||
    !String(reply.message_id || '').trim() ||
    !String(reply.thread_id || '').trim() ||
    !/^<[^<>\s]+>$/.test(String(metadata.internetMessageId || '')) ||
    !Number.isFinite(Date.parse(String(reply.received_at || '')))
  ) {
    throw new Error('The exact founder-reviewed seller reply, lead, property, content, or Graph identity is not eligible.')
  }
  return { lead, reply, message: { ...message, variant_key: messageVersionKey }, version, strategy }
}

export async function saveGate3d1LocalReplyDraft(input: {
  actorUserId: string
  leadId: string
  replyMemoryId: string
  subject?: string | null
  authoredComment: string
  messageVersionKey: string
  idempotencyKey: string
}) {
  const actorUserId = exactUuid(input.actorUserId, 'Founder actor ID')
  await assertGate3d1FounderActor(actorUserId)
  const leadId = exactUuid(input.leadId, 'Lead ID')
  const replyMemoryId = exactUuid(input.replyMemoryId, 'Reply-memory ID')
  const messageVersionKey = exactGateKey(input.messageVersionKey, 'Message version key')
  const draftIdempotencyKey = exactGateKey(input.idempotencyKey, 'Draft idempotency key')
  const body = buildGate3d1CompliantReplyComment(input.authoredComment)
  const complianceNote = `Exact positive-inbound same-thread continuation with postal identity and clear opt-out. Draft idempotency: ${draftIdempotencyKey}.`
  const admin = createAdminClient()
  const [leadResult, replyResult, existingResult] = await Promise.all([
    admin.from('leads').select('id,email,property_address').eq('id', leadId).limit(2),
    admin
      .from('command_center_reply_memory')
      .select('id,lead_id,mailbox,from_email,to_email,subject,reply_summary,property_address,classification,metadata_json')
      .eq('id', replyMemoryId)
      .limit(2),
    admin
      .from('outreach_messages')
      .select('id,lead_id,channel,subject,body,variant_key,status,generated_with,compliance_note')
      .eq('lead_id', leadId)
      .eq('channel', 'email')
      .eq('generated_with', GATE3D1_GENERATOR)
      .eq('variant_key', messageVersionKey)
      .limit(2),
  ])
  for (const result of [leadResult, replyResult, existingResult]) {
    if (result.error) throw new Error(`Gate 3D.1 local draft failed closed: ${result.error.message}`)
  }
  if ((leadResult.data || []).length !== 1 || (replyResult.data || []).length !== 1) {
    throw new Error('Gate 3D.1 local draft requires one exact lead and positive inbound reply.')
  }
  const lead = leadResult.data![0] as Record<string, unknown>
  const reply = replyResult.data![0] as Record<string, unknown>
  const metadata = reply.metadata_json && typeof reply.metadata_json === 'object'
    ? reply.metadata_json as Record<string, unknown>
    : {}
  const config = dedicatedGraphConfig()
  if (
    String(reply.lead_id || '') !== leadId ||
    String(reply.classification || '') !== 'hot_seller_lead' ||
    !isConservativePositiveSellerReplyText({
      subject: String(reply.subject || ''),
      bodyPreview: String(reply.reply_summary || ''),
    }) ||
    metadata.explicitOptOut === true ||
    !hasExactGate3d1ReplyMemoryProvenance(metadata, {
      tenantId: config.tenantId,
      mailboxObjectId: config.mailboxObjectId,
    }) ||
    String(reply.mailbox || '').trim().toLowerCase() !== config.mailboxAddress ||
    String(reply.to_email || '').trim().toLowerCase() !== config.mailboxAddress ||
    String(reply.from_email || '').trim().toLowerCase() !== String(lead.email || '').trim().toLowerCase() ||
    !String(lead.property_address || '').trim()
  ) {
    throw new Error('The local draft is not tied to the exact positive inbound seller reply and property.')
  }
  const existing = selectExactGate3d1LocalDraft(
    (existingResult.data || []) as Array<Record<string, unknown>>,
    {
      leadId,
      generator: GATE3D1_GENERATOR,
      messageVersionKey,
    }
  ) || undefined
  if (
    existing &&
    (String(existing.generated_with || '') !== GATE3D1_GENERATOR ||
      String(existing.variant_key || '') !== messageVersionKey ||
      String(existing.status || '') !== 'needs_review')
  ) {
    throw new Error('An existing Gate 3D.1 draft is not in the exact reviewable state and cannot be overwritten.')
  }
  if (
    existing &&
    String(existing.compliance_note || '') !== complianceNote
  ) {
    throw new Error('The Gate 3D.1 message version is already bound to a different draft idempotency key.')
  }
  if (
    existing &&
    (
      String(existing.body || '') !== body ||
      String(existing.variant_key || '') !== messageVersionKey ||
      String(existing.subject || '') !== String(input.subject?.trim() || '')
    )
  ) {
    throw new Error('Draft idempotency key was already used for different authored content.')
  }
  const payload = {
    lead_id: leadId,
    channel: 'email',
    subject: input.subject?.trim() || null,
    body,
    cta: null,
    language: 'en',
    variant_key: messageVersionKey,
    compliance_note: complianceNote,
    generated_with: GATE3D1_GENERATOR,
    status: 'needs_review',
    approved_at: null,
    approved_by_user_id: null,
    last_generated_at: new Date().toISOString(),
  }
  const { data, error } = existing
    ? {
        data: {
          id: existing.id,
          lead_id: existing.lead_id,
          status: existing.status,
          variant_key: existing.variant_key,
          body: existing.body,
        },
        error: null,
      }
    : await admin
        .from('outreach_messages')
        .insert(payload)
        .select('id,lead_id,status,variant_key,body')
        .single()
  if (error || !data) throw new Error(`Gate 3D.1 local draft could not be saved: ${error?.message || 'unknown write error'}`)
  return {
    messageId: exactUuid(data.id, 'Local outreach message ID'),
    leadId,
    replyMemoryId,
    status: 'needs_review' as const,
    messageVersionKey,
    contentFingerprint: fingerprintGate3d1GraphReplyContent({
      outreachMessageId: data.id,
      sourceIdentifier: 'seller_options_intake',
      outreachPurpose: GATE3D1_PURPOSE,
      messageVersionKey,
      comment: data.body,
    }),
    providerMutation: false as const,
  }
}

export async function recordGate3d1ExchangeRbacAttestation(input: {
  actorUserId: string
  outOfScopeMailboxObjectId: string
  inScopeProofFingerprint: string
  outOfScopeDenyProofFingerprint: string
  expiresAt: string
  rationale: string
  idempotencyKey: string
}) {
  const actorUserId = await assertGate3d1FounderActor(input.actorUserId)
  const expiresAtMs = Date.parse(input.expiresAt)
  const now = Date.now()
  if (
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= now + 5 * 60_000 ||
    expiresAtMs > now + 24 * 60 * 60_000
  ) {
    throw new Error('Founder RBAC proof must expire between five minutes and 24 hours from now.')
  }
  const config = dedicatedGraphConfig()
  const outOfScopeMailboxObjectId = exactUuid(
    input.outOfScopeMailboxObjectId,
    'Out-of-scope mailbox object ID'
  )
  if (outOfScopeMailboxObjectId === config.mailboxObjectId) {
    throw new Error('The RBAC deny proof must use a different out-of-scope mailbox.')
  }
  const inScopeProofFingerprint = exactSha256(
    input.inScopeProofFingerprint,
    'In-scope RBAC proof'
  )
  const outOfScopeDenyProofFingerprint = exactSha256(
    input.outOfScopeDenyProofFingerprint,
    'Out-of-scope RBAC deny proof'
  )
  if (inScopeProofFingerprint === outOfScopeDenyProofFingerprint) {
    throw new Error('In-scope and out-of-scope RBAC proofs must be distinct.')
  }
  const rbacAttestationId = exactUuid(await founderRpc(
    'record_exchange_application_rbac_attestation',
    {
      p_tenant_id: config.tenantId,
      p_client_id: config.clientId,
      p_mailbox_object_id: config.mailboxObjectId,
      p_out_of_scope_mailbox_object_id: outOfScopeMailboxObjectId,
      p_mailbox_address: config.mailboxAddress,
      p_rbac_role_set_json: ['Application Mail.ReadWrite', 'Application Mail.Send'],
      p_in_scope_proof_fingerprint: inScopeProofFingerprint,
      p_out_of_scope_deny_proof_fingerprint: outOfScopeDenyProofFingerprint,
      p_expires_at: input.expiresAt,
      p_actor_user_id: actorUserId,
      p_rationale: input.rationale.trim(),
      p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
      p_idempotency_key: exactGateKey(input.idempotencyKey, 'RBAC idempotency key'),
    },
    'Founder Exchange Application RBAC attestation'
  ), 'Exchange Application RBAC attestation ID')
  return {
    rbacAttestationId,
    expiresAt: input.expiresAt,
    exactRoles: ['Application Mail.ReadWrite', 'Application Mail.Send'] as const,
    continuationAuthorizationStillRequired: true as const,
    providerMutation: false as const,
  }
}

export async function authorizeGate3d1ReplyContinuation(input: {
  actorUserId: string
  operatingStrategyVersionId: string
  replyMemoryId: string
  outreachMessageId: string
  exchangeRbacAttestationId: string
  reviewedPositiveReplySummarySha256: string
  recipientTimeZone: string
  expiresAt: string
  rationale: string
  idempotencyKey: string
}) {
  const actorUserId = exactUuid(input.actorUserId, 'Founder actor ID')
  await assertGate3d1FounderActor(actorUserId)
  const operatingStrategyVersionId = exactUuid(input.operatingStrategyVersionId, 'Operating strategy version ID')
  const replyMemoryId = exactUuid(input.replyMemoryId, 'Reply-memory ID')
  const outreachMessageId = exactUuid(input.outreachMessageId, 'Outreach message ID')
  const rbacAttestationId = exactUuid(
    input.exchangeRbacAttestationId,
    'Exchange Application RBAC attestation ID'
  )
  const reviewedPositiveReplySummarySha256 = exactSha256(
    input.reviewedPositiveReplySummarySha256,
    'Founder-reviewed positive reply-summary fingerprint'
  )
  const idempotencyKey = exactGateKey(input.idempotencyKey, 'Continuation idempotency key')
  assertIanaTimeZone(input.recipientTimeZone)
  const expiresAtMs = Date.parse(input.expiresAt)
  const now = Date.now()
  if (
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= now + 5 * 60_000 ||
    expiresAtMs > now + 24 * 60 * 60_000
  ) {
    throw new Error('Founder authorization and RBAC proof must expire between five minutes and 24 hours from now.')
  }
  const evidence = await loadExactReplyEvidence({
    actorUserId,
    operatingStrategyVersionId,
    replyMemoryId,
    outreachMessageId,
  })
  const config = dedicatedGraphConfig()
  const replyMetadata = evidence.reply.metadata_json as Record<string, unknown>
  const recipientEmail = String(evidence.reply.from_email || '').trim().toLowerCase()
  const propertyAddress = String(evidence.lead.property_address || '').replace(/\s+/g, ' ').trim()
  const body = String(evidence.message.body || '')
  const replySummary = String(evidence.reply.reply_summary || '')
  if (
    !replySummary.trim() ||
    replySummary === 'No message preview was returned by Outlook.' ||
    sha256(replySummary) !== reviewedPositiveReplySummarySha256
  ) {
    throw new Error('Founder positive-review confirmation does not match the exact stored inbound reply summary.')
  }
  const contentFingerprint = fingerprintGate3d1GraphReplyContent({
    outreachMessageId,
    sourceIdentifier: 'seller_options_intake',
    outreachPurpose: GATE3D1_PURPOSE,
    messageVersionKey: String(evidence.message.variant_key),
    comment: body,
  })
  const authorizationId = exactUuid(await founderRpc(
    'record_inbound_reply_continuation_authorization',
    {
      p_operating_strategy_version_id: operatingStrategyVersionId,
      p_lead_id: evidence.lead.id,
      p_reply_memory_id: replyMemoryId,
      p_outreach_message_id: outreachMessageId,
      p_exchange_rbac_attestation_id: rbacAttestationId,
      p_tenant_id: config.tenantId,
      p_client_id: config.clientId,
      p_mailbox_object_id: config.mailboxObjectId,
      p_mailbox_address: config.mailboxAddress,
      p_inbound_message_id: evidence.reply.message_id,
      p_inbound_conversation_id: evidence.reply.thread_id,
      p_inbound_internet_message_id: replyMetadata.internetMessageId,
      p_normalized_sender_hash: sha256(recipientEmail),
      p_normalized_recipient_hash: sha256(config.mailboxAddress),
      p_property_reference_key: propertyAddress,
      p_purpose_key: GATE3D1_PURPOSE,
      p_approved_content_fingerprint: contentFingerprint,
      p_draft_version_key: evidence.message.variant_key,
      p_positive_classification_evidence_fingerprint: reviewedPositiveReplySummarySha256,
      p_local_timezone: input.recipientTimeZone,
      p_allowed_local_start: GATE3D1_LOCAL_START,
      p_allowed_local_end: GATE3D1_LOCAL_END,
      p_allowed_iso_weekdays: [...GATE3D1_ISO_WEEKDAYS],
      p_expires_at: input.expiresAt,
      p_actor_user_id: actorUserId,
      p_rationale: input.rationale.trim(),
      p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
      p_idempotency_key: idempotencyKey,
    },
    'Founder positive-inbound reply continuation authorization'
  ), 'Inbound reply continuation authorization ID')

  const admin = createAdminClient()
  const { data: approved, error: approvedError } = await admin
    .from('outreach_messages')
    .select('id,status,approved_by_user_id,body,variant_key')
    .eq('id', outreachMessageId)
    .single()
  if (
    approvedError ||
    !approved ||
    approved.status !== 'approved' ||
    approved.approved_by_user_id !== actorUserId ||
    approved.body !== body ||
    approved.variant_key !== evidence.message.variant_key
  ) {
    throw new Error('Founder continuation authority did not atomically approve the exact authored message.')
  }
  return {
    authorizationId,
    rbacAttestationId,
    operatingStrategyVersionId,
    replyMemoryId,
    outreachMessageId,
    contentFingerprint,
    reviewedPositiveReplySummarySha256,
    expiresAt: input.expiresAt,
    authorizationBasis: 'positive_inbound_reply_continuation' as const,
    marketingConsentGranted: false as const,
    providerMutation: false as const,
  }
}

export async function revokeGate3d1ReplyContinuation(input: {
  actorUserId: string
  authorizationId: string
  reason: string
  idempotencyKey: string
}) {
  const actorUserId = exactUuid(input.actorUserId, 'Founder actor ID')
  await assertGate3d1FounderActor(actorUserId)
  const authorizationId = exactUuid(input.authorizationId, 'Continuation authorization ID')
  const revocationId = exactUuid(await founderRpc(
    'revoke_inbound_reply_continuation_authorization',
    {
      p_authorization_id: authorizationId,
      p_actor_user_id: actorUserId,
      p_reason: input.reason.trim(),
      p_idempotency_key: exactGateKey(input.idempotencyKey, 'Revocation idempotency key'),
    },
    'Founder continuation revocation'
  ), 'Continuation revocation ID')
  return { authorizationId, revocationId, providerMutation: false as const }
}

export async function reconcileGate3d1ReplyDispatch(input: {
  actorUserId: string
  claimId: string
  resolution: 'reconciled_accepted' | 'reconciled_not_sent' | 'dead_lettered'
  providerEvidenceFingerprint: string
  reason: string
  idempotencyKey: string
}) {
  const actorUserId = exactUuid(input.actorUserId, 'Founder actor ID')
  await assertGate3d1FounderActor(actorUserId)
  const claimId = exactUuid(input.claimId, 'Gate 3D.1 claim ID')
  const reconciliationEventId = exactUuid(await founderRpc(
    'reconcile_gate3d1_canary_dispatch',
    {
      p_claim_id: claimId,
      p_resolution: input.resolution,
      p_provider_evidence_fingerprint: exactSha256(
        input.providerEvidenceFingerprint,
        'Provider reconciliation evidence'
      ),
      p_actor_user_id: actorUserId,
      p_reason: input.reason.trim(),
      p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
      p_idempotency_key: exactGateKey(input.idempotencyKey, 'Reconciliation idempotency key'),
    },
    'Founder Gate 3D.1 provider reconciliation'
  ), 'Gate 3D.1 reconciliation event ID')
  return { claimId, reconciliationEventId, resolution: input.resolution, providerMutation: false as const }
}

export async function stageGate3d1ActivationReview(input: {
  actorUserId: string
  operatingStrategyVersionId: string
  reason: string
  idempotencyKey: string
}) {
  const actorUserId = await assertGate3d1FounderActor(input.actorUserId)
  const operatingStrategyVersionId = exactUuid(
    input.operatingStrategyVersionId,
    'Operating strategy version ID'
  )
  const idempotencyKey = exactGateKey(input.idempotencyKey, 'Activation-review idempotency key')
  const staged = await founderRpc(
    'stage_gate3d1_canary_review',
    {
      p_operating_strategy_version_id: operatingStrategyVersionId,
      p_expected_operating_contract_fingerprint: GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT,
      p_actor_user_id: actorUserId,
      p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
      p_reason: input.reason.trim(),
    },
    'Founder Gate 3D.1 canary staging'
  )
  const stagedRecord = staged && typeof staged === 'object' && !Array.isArray(staged)
    ? staged as Record<string, unknown>
    : null
  if (
    !stagedRecord ||
    stagedRecord.operatingStrategyVersionId !== operatingStrategyVersionId ||
    stagedRecord.canaryEnforcementStatus !== 'reviewed_cap_one' ||
    stagedRecord.writerRelease !== GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE ||
    stagedRecord.blocked !== true
  ) {
    throw new Error('Gate 3D.1 staging returned incomplete or conflicting reviewed-cap-one evidence.')
  }

  const admin = createAdminClient()
  const proposedChange = {
    targetStatus: 'active',
    gate: '3D.1',
    strategyKey: 'seller_options_intake',
    expectedOperatingContractFingerprint: GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT,
    writerRelease: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
  }
  const { data: manifestData, error: manifestError } = await admin.rpc(
    'submit_operating_strategy_review_manifest',
    {
      p_operating_strategy_version_id: operatingStrategyVersionId,
      p_review_type: 'activation_review',
      p_proposal_key: 'gate3d1_seller_reply_activation_v1',
      p_proposed_change_json: proposedChange,
      p_learning_window_ids: [],
      p_proposed_by_kind: 'system',
      p_proposed_by_key: GATE3D1_ACTIVATION_PROPOSER_KEY,
      p_proposed_by_user_id: null,
      p_idempotency_key: idempotencyKey,
      p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
    }
  )
  if (manifestError) {
    throw new Error(`Gate 3D.1 activation-review proposal failed closed: ${manifestError.message}`)
  }
  const manifestId = exactUuid(manifestData, 'Activation review manifest ID')
  const { data: manifest, error: manifestLookupError } = await admin
    .from('operating_strategy_review_manifests')
    .select('id,operating_strategy_version_id,review_type,proposal_key,proposed_change_json,proposed_by_key,operating_contract_fingerprint,writer_release,proposal_fingerprint,apply_status')
    .eq('id', manifestId)
    .single()
  if (
    manifestLookupError ||
    !manifest ||
    manifest.operating_strategy_version_id !== operatingStrategyVersionId ||
    manifest.review_type !== 'activation_review' ||
    manifest.proposed_by_key !== GATE3D1_ACTIVATION_PROPOSER_KEY ||
    manifest.operating_contract_fingerprint !== GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT ||
    manifest.writer_release !== GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE ||
    manifest.apply_status !== 'pending_human_review' ||
    !/^[0-9a-f]{32}$/.test(String(manifest.proposal_fingerprint || ''))
  ) {
    throw new Error('Gate 3D.1 activation-review manifest could not be verified exactly.')
  }
  return {
    operatingStrategyVersionId,
    manifestId,
    proposalFingerprint: manifest.proposal_fingerprint,
    proposalActor: GATE3D1_ACTIVATION_PROPOSER_KEY,
    founderDecisionRequired: true as const,
    controlsRemainBlocked: true as const,
    providerMutation: false as const,
  }
}

export async function recordGate3d1ActivationApproval(input: {
  actorUserId: string
  operatingStrategyVersionId: string
  manifestId: string
  expectedProposalFingerprint: string
  rationale: string
  idempotencyKey: string
}) {
  const actorUserId = await assertGate3d1FounderActor(input.actorUserId)
  const operatingStrategyVersionId = exactUuid(
    input.operatingStrategyVersionId,
    'Operating strategy version ID'
  )
  const manifestId = exactUuid(input.manifestId, 'Activation review manifest ID')
  const expectedProposalFingerprint = String(input.expectedProposalFingerprint || '').trim().toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(expectedProposalFingerprint)) {
    throw new Error('Activation review requires the exact 32-character proposal fingerprint.')
  }
  const admin = createAdminClient()
  const { data: manifest, error: manifestError } = await admin
    .from('operating_strategy_review_manifests')
    .select('id,operating_strategy_version_id,review_type,proposal_fingerprint,writer_release,apply_status')
    .eq('id', manifestId)
    .single()
  if (
    manifestError ||
    !manifest ||
    manifest.operating_strategy_version_id !== operatingStrategyVersionId ||
    manifest.review_type !== 'activation_review' ||
    manifest.proposal_fingerprint !== expectedProposalFingerprint ||
    manifest.writer_release !== GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE ||
    manifest.apply_status !== 'pending_human_review'
  ) {
    throw new Error('The activation approval request does not match the exact staged review manifest.')
  }
  const decisionId = exactUuid(await founderRpc(
    'record_operating_strategy_review_decision',
    {
      p_manifest_id: manifestId,
      p_decision: 'approved',
      p_reviewed_by_user_id: actorUserId,
      p_reviewed_by_key: GATE3D1_ACTIVATION_REVIEWER_KEY,
      p_rationale: input.rationale.trim(),
      p_expected_proposal_fingerprint: expectedProposalFingerprint,
      p_idempotency_key: exactGateKey(input.idempotencyKey, 'Activation-decision idempotency key'),
    },
    'Founder Gate 3D.1 activation decision'
  ), 'Activation review decision ID')
  return {
    operatingStrategyVersionId,
    manifestId,
    decisionId,
    decision: 'approved' as const,
    activationStillRequired: true as const,
    controlsRemainBlocked: true as const,
    providerMutation: false as const,
  }
}

export async function activateGate3d1Canary(input: {
  actorUserId: string
  operatingStrategyVersionId: string
  manifestId: string
  expectedProposalFingerprint: string
  idempotencyKey: string
}) {
  const actorUserId = await assertGate3d1FounderActor(input.actorUserId)
  const operatingStrategyVersionId = exactUuid(
    input.operatingStrategyVersionId,
    'Operating strategy version ID'
  )
  const manifestId = exactUuid(input.manifestId, 'Activation review manifest ID')
  const expectedProposalFingerprint = String(input.expectedProposalFingerprint || '')
    .trim()
    .toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(expectedProposalFingerprint)) {
    throw new Error('Activation requires the exact 32-character proposal fingerprint.')
  }
  const activationIdempotencyKey = exactGateKey(
    input.idempotencyKey,
    'Version-activation idempotency key'
  )
  const admin = createAdminClient()
  const [manifestResult, decisionResult, versionResult] = await Promise.all([
    admin
      .from('operating_strategy_review_manifests')
      .select('id,operating_strategy_version_id,review_type,proposal_fingerprint,writer_release,apply_status')
      .eq('id', manifestId)
      .single(),
    admin
      .from('operating_strategy_review_decisions')
      .select('id,manifest_id,decision,reviewed_by_user_id,expected_proposal_fingerprint')
      .eq('manifest_id', manifestId)
      .single(),
    admin
      .from('operating_strategy_versions')
      .select('id,status,execution_mode,external_send_cap,approved_by_user_id,operating_strategy_id')
      .eq('id', operatingStrategyVersionId)
      .single(),
  ])
  const manifest = manifestResult.data
  const decision = decisionResult.data
  const before = versionResult.data
  if (
    manifestResult.error ||
    decisionResult.error ||
    versionResult.error ||
    !manifest ||
    !decision ||
    !before ||
    manifest.operating_strategy_version_id !== operatingStrategyVersionId ||
    manifest.review_type !== 'activation_review' ||
    manifest.proposal_fingerprint !== expectedProposalFingerprint ||
    manifest.writer_release !== GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE ||
    manifest.apply_status !== 'pending_human_review' ||
    decision.manifest_id !== manifestId ||
    decision.decision !== 'approved' ||
    decision.reviewed_by_user_id !== actorUserId ||
    decision.expected_proposal_fingerprint !== expectedProposalFingerprint
  ) {
    throw new Error('Gate 3D.1 activation requires the exact separate founder-approved manifest decision.')
  }
  let activated = before
  if (before.status !== 'active') {
    const activationData = await founderRpc(
      'activate_operating_strategy_version',
      {
        p_version_id: operatingStrategyVersionId,
        p_actor_user_id: actorUserId,
      },
      'Founder Gate 3D.1 operating-version activation'
    )
    const rows = (Array.isArray(activationData) ? activationData : activationData ? [activationData] : []) as Array<Record<string, unknown>>
    if (rows.length !== 1) {
      throw new Error('Gate 3D.1 activation must return exactly one operating version.')
    }
    activated = rows[0] as typeof before
  }
  if (
    activated.id !== operatingStrategyVersionId ||
    activated.status !== 'active' ||
    activated.execution_mode !== 'approved_live' ||
    Number(activated.external_send_cap) !== 1 ||
    activated.approved_by_user_id !== actorUserId
  ) {
    throw new Error('Gate 3D.1 activation returned an inexact or unsafe operating version.')
  }
  return {
    operatingStrategyVersionId,
    operatingStrategyId: exactUuid(activated.operating_strategy_id, 'Activated operating strategy ID'),
    manifestId,
    decisionId: exactUuid(decision.id, 'Activation review decision ID'),
    idempotencyKey: activationIdempotencyKey,
    status: 'active' as const,
    controlsRemainBlocked: true as const,
    providerMutation: false as const,
  }
}

export async function releaseGate3d1CanaryControls(input: {
  actorUserId: string
  operatingStrategyVersionId: string
  reason: string
  idempotencyKey: string
}) {
  const actorUserId = await assertGate3d1FounderActor(input.actorUserId)
  const operatingStrategyVersionId = exactUuid(
    input.operatingStrategyVersionId,
    'Operating strategy version ID'
  )
  const idempotencyKey = exactGateKey(input.idempotencyKey, 'Control-release idempotency key')
  const admin = createAdminClient()
  const { data: version, error } = await admin
    .from('operating_strategy_versions')
    .select('id,operating_strategy_id,status,execution_mode,external_send_cap,approved_by_user_id')
    .eq('id', operatingStrategyVersionId)
    .single()
  if (
    error ||
    !version ||
    version.status !== 'active' ||
    version.execution_mode !== 'approved_live' ||
    Number(version.external_send_cap) !== 1 ||
    version.approved_by_user_id !== actorUserId
  ) {
    throw new Error('Only the exact founder-activated cap-one version may release Gate 3D.1 controls.')
  }
  const operatingStrategyId = exactUuid(version.operating_strategy_id, 'Operating strategy ID')
  const reason = `${input.reason.trim()} [${idempotencyKey}]`
  const strategyResult = await founderRpc(
    'set_operating_strategy_outbound_control',
    {
      p_operating_strategy_id: operatingStrategyId,
      p_blocked: false,
      p_actor_user_id: actorUserId,
      p_reason: reason,
      p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
    },
    'Founder Gate 3D.1 strategy-control release'
  )
  const globalResult = await founderRpc(
    'set_operating_strategy_outbound_control',
    {
      p_operating_strategy_id: null,
      p_blocked: false,
      p_actor_user_id: actorUserId,
      p_reason: reason,
      p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
    },
    'Founder Gate 3D.1 global-control release'
  )
  for (const [scope, result] of [['strategy', strategyResult], ['global', globalResult]] as const) {
    const record = result && typeof result === 'object' && !Array.isArray(result)
      ? result as Record<string, unknown>
      : null
    if (!record || record.scope !== scope || record.blocked !== false || record.actorUserId !== actorUserId) {
      throw new Error(`Gate 3D.1 ${scope} control release returned conflicting evidence.`)
    }
  }
  return {
    operatingStrategyVersionId,
    operatingStrategyId,
    releaseOrder: ['strategy', 'global'] as const,
    blocked: false as const,
    providerMutation: false as const,
  }
}

export async function stopGate3d1CanaryControls(input: {
  actorUserId: string
  operatingStrategyId: string
  reason: string
  idempotencyKey: string
}) {
  const actorUserId = await assertGate3d1FounderActor(input.actorUserId)
  const operatingStrategyId = exactUuid(input.operatingStrategyId, 'Operating strategy ID')
  const idempotencyKey = exactGateKey(input.idempotencyKey, 'Control-stop idempotency key')
  const reason = `${input.reason.trim()} [${idempotencyKey}]`
  const globalResult = await founderRpc(
    'set_operating_strategy_outbound_control',
    {
      p_operating_strategy_id: null,
      p_blocked: true,
      p_actor_user_id: actorUserId,
      p_reason: reason,
      p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
    },
    'Founder Gate 3D.1 global stop'
  )
  await founderRpc(
    'set_operating_strategy_outbound_control',
    {
      p_operating_strategy_id: operatingStrategyId,
      p_blocked: true,
      p_actor_user_id: actorUserId,
      p_reason: reason,
      p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
    },
    'Founder Gate 3D.1 strategy stop'
  )
  const globalRecord = globalResult && typeof globalResult === 'object' && !Array.isArray(globalResult)
    ? globalResult as Record<string, unknown>
    : null
  if (!globalRecord || globalRecord.scope !== 'global' || globalRecord.blocked !== true) {
    throw new Error('Gate 3D.1 global stop returned conflicting evidence.')
  }
  return { operatingStrategyId, stopOrder: ['global', 'strategy'] as const, blocked: true as const }
}

export async function executeAuthorizedGate3d1Reply(input: {
  actorUserId: string
  authorizationId: string
  outreachMessageId: string
  idempotencyKey: string
}) {
  const executionIdempotencyKey = exactGateKey(
    input.idempotencyKey,
    'Execution idempotency key'
  )
  const request = await resolveGate3d1ExecutionOrStop({
    resolve: async () => {
      await assertGate3d1FounderActor(input.actorUserId)
      return resolveGate3d1GraphReplyExecutionRequest({
        authorizationId: input.authorizationId,
        outreachMessageId: input.outreachMessageId,
        idempotencyKey: executionIdempotencyKey,
      })
    },
    engageStops: async (resolutionError) => {
      const admin = createAdminClient()
      const { data: controls, error: controlsError } = await admin
        .from('operating_strategy_runtime_controls')
        .select('canary_enforcement_status,canary_operating_strategy_version_id,canary_required_writer_release')
        .eq('control_key', 'canonical_binding')
        .limit(2)
      if (
        controlsError ||
        (controls || []).length !== 1 ||
        controls![0].canary_enforcement_status !== 'reviewed_cap_one' ||
        controls![0].canary_required_writer_release !==
          GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE
      ) {
        throw new Error('The exact selective canary runtime control could not be resolved.')
      }
      const operatingStrategyVersionId = exactUuid(
        controls![0].canary_operating_strategy_version_id,
        'Pre-core stop operating strategy version ID'
      )
      const evidenceFingerprint = sha256(JSON.stringify({
        schema: 'gate3d1.pre-core-manifest-failure.v1',
        operatingStrategyVersionId,
        authorizationId: input.authorizationId,
        outreachMessageId: input.outreachMessageId,
        failureType: resolutionError instanceof Error ? resolutionError.name : 'unknown_error',
      }))
      const { data: stopData, error: stopError } = await admin.rpc(
        'engage_gate3d1_canary_stop',
        {
          p_operating_strategy_version_id: operatingStrategyVersionId,
          p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
          p_reason: 'Gate 3D.1 stopped before execution manifest resolution completed.',
          p_evidence_fingerprint: evidenceFingerprint,
          p_idempotency_key:
            `gate3d1-pre-core-stop:${sha256(executionIdempotencyKey).slice(0, 32)}`,
        }
      )
      const stopRecord = stopData && typeof stopData === 'object' && !Array.isArray(stopData)
        ? stopData as Record<string, unknown>
        : null
      if (
        stopError ||
        !stopRecord ||
        stopRecord.operatingStrategyVersionId !== operatingStrategyVersionId ||
        stopRecord.blocked !== true ||
        stopRecord.evidenceFingerprint !== evidenceFingerprint
      ) {
        throw new Error(stopError?.message || 'The stop RPC returned conflicting evidence.')
      }
    },
  })
  return executeGate3d1GraphSameThreadReplyCanary(request)
}

export async function getGate3d1FounderControlReadiness(actorUserId: string) {
  const exactActor = exactUuid(actorUserId, 'Founder actor ID')
  if (exactActor !== GATE3D1_FOUNDER_USER_ID) {
    throw new Error('Only the exact verified VestBlock founder may inspect Gate 3D.1 readiness.')
  }
  let founderAuthorityReady = false
  let founderAuthorityBlocker: string | null = null
  try {
    await assertGate3d1FounderActor(exactActor)
    founderAuthorityReady = true
  } catch {
    founderAuthorityBlocker =
      'Founder reviewer authority is absent or inactive; use the explicit authenticated bootstrap POST once.'
  }

  let databaseControls: {
    available: boolean
    blocker: string | null
    operatingStrategyId: string | null
    operatingStrategyVersionId: string | null
    operatingStrategyVersionStatus: string | null
    globalStopEngaged: boolean | null
    strategyStopEngaged: boolean | null
    canaryEnforcementStatus: string | null
    stagedVersionMatches: boolean
    writerReleaseMatches: boolean
  } = {
    available: false,
    blocker: 'Gate 3D.1 database controls or candidate migration are unavailable.',
    operatingStrategyId: null,
    operatingStrategyVersionId: null,
    operatingStrategyVersionStatus: null,
    globalStopEngaged: null,
    strategyStopEngaged: null,
    canaryEnforcementStatus: null,
    stagedVersionMatches: false,
    writerReleaseMatches: false,
  }
  try {
    const admin = createAdminClient()
    const strategyResult = await admin
      .from('operating_strategies')
      .select('id,strategy_key')
      .eq('strategy_key', 'seller_options_intake')
      .limit(2)
    if (strategyResult.error || (strategyResult.data || []).length !== 1) {
      throw new Error('The exact seller operating strategy is unavailable or ambiguous.')
    }
    const operatingStrategyId = exactUuid(
      strategyResult.data![0].id,
      'Readiness operating strategy ID'
    )
    const [versionResult, globalResult, strategyControlResult] = await Promise.all([
      admin
        .from('operating_strategy_versions')
        .select('id,version,status,execution_mode,external_send_cap,approved_by_user_id')
        .eq('operating_strategy_id', operatingStrategyId)
        .eq('version', 1)
        .limit(2),
      admin
        .from('operating_strategy_runtime_controls')
        .select('canary_enforcement_status,canary_operating_strategy_version_id,canary_required_writer_release,outbound_kill_switch')
        .eq('control_key', 'canonical_binding')
        .limit(2),
      admin
        .from('operating_strategy_outbound_controls')
        .select('operating_strategy_id,paused,writer_release')
        .eq('operating_strategy_id', operatingStrategyId)
        .limit(2),
    ])
    if (
      versionResult.error ||
      globalResult.error ||
      strategyControlResult.error ||
      (versionResult.data || []).length !== 1 ||
      (globalResult.data || []).length !== 1 ||
      (strategyControlResult.data || []).length !== 1
    ) {
      throw new Error('The exact Gate 3D.1 candidate or control rows are unavailable.')
    }
    const version = versionResult.data![0]
    const globalControl = globalResult.data![0]
    const strategyControl = strategyControlResult.data![0]
    const operatingStrategyVersionId = exactUuid(
      version.id,
      'Readiness operating strategy version ID'
    )
    databaseControls = {
      available: true,
      blocker: null,
      operatingStrategyId,
      operatingStrategyVersionId,
      operatingStrategyVersionStatus: String(version.status || ''),
      globalStopEngaged: globalControl.outbound_kill_switch === true,
      strategyStopEngaged: strategyControl.paused === true,
      canaryEnforcementStatus: String(globalControl.canary_enforcement_status || ''),
      stagedVersionMatches:
        globalControl.canary_operating_strategy_version_id === operatingStrategyVersionId,
      writerReleaseMatches:
        globalControl.canary_required_writer_release ===
          GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE &&
        (strategyControl.paused === true ||
          strategyControl.writer_release === GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE),
    }
  } catch (error) {
    databaseControls.blocker = error instanceof Error
      ? error.message
      : databaseControls.blocker
  }

  const graphReadiness = await getGate3d1GraphReplyCanaryReadiness()
  const databaseExecutionReady = Boolean(
    databaseControls.available &&
    databaseControls.operatingStrategyVersionStatus === 'active' &&
    databaseControls.globalStopEngaged === false &&
    databaseControls.strategyStopEngaged === false &&
    databaseControls.canaryEnforcementStatus === 'reviewed_cap_one' &&
    databaseControls.stagedVersionMatches &&
    databaseControls.writerReleaseMatches
  )
  return {
    ...graphReadiness,
    exactFounderAuthenticated: true,
    founderAuthorityReady,
    founderAuthorityBlocker,
    bootstrapRequired: !founderAuthorityReady,
    databaseControls,
    executionReady: Boolean(
      founderAuthorityReady &&
      databaseExecutionReady &&
      graphReadiness.configured &&
      graphReadiness.enabled &&
      graphReadiness.oneRecipientPinned &&
      graphReadiness.capIsOne &&
      graphReadiness.founderManifestPinned &&
      graphReadiness.rbacAttestation.current &&
      graphReadiness.inboundCallbackScope.ready
    ),
    writerRelease: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
    preparedDraftOperatingContractFingerprint:
      GATE3D1_SELLER_REPLY_CANARY_AFTER_FINGERPRINT,
    activeRuntimeFingerprintSource: 'database_resolver_after_activation',
    requiredLocalWindow: {
      start: GATE3D1_LOCAL_START,
      end: GATE3D1_LOCAL_END,
      isoWeekdays: [...GATE3D1_ISO_WEEKDAYS],
      timeZoneSource: 'founder_authorization',
    },
    mutationMethods: {
      bootstrap: 'POST',
      stageActivationReview: 'POST',
      approveActivation: 'POST',
      activateVersion: 'POST',
      releaseControls: 'POST',
      stopControls: 'POST',
      draft: 'POST',
      recordRbacAttestation: 'POST',
      authorize: 'POST',
      revoke: 'POST',
      execute: 'POST',
      reconcile: 'POST',
    },
    activationRunbook: [
      'bootstrap_exact_founder',
      'stage_cap_one_candidate_while_stopped',
      'submit_service_proposal',
      'record_separate_founder_approval',
      'activate_exact_version_while_stopped',
      'record_scoped_rbac_attestation',
      'record_exact_positive_reply_continuation_authority',
      'release_strategy_then_global',
      'execute_one_exact_fingerprinted_reply',
      'send_permit_reengages_both_stops',
    ],
    providerMutationOnReadiness: false,
  }
}
