import 'server-only'

import { createHash } from 'node:crypto'

import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { recordStrategyDeliveryOutcome } from '@/lib/admin/strategyDelivery'
import { updateBuyerRecord, upsertBuyer } from '@/lib/buyers/repository'
import { getConfiguredGate3d1InboundMailboxScope } from '@/lib/email/gate3d1InboundMailboxScope'
import {
  isGate3d1FounderReviewableSellerReplyText,
  isExplicitEmailOptOutText,
  isExactGate3d1GraphReplyCallback,
  resolveMicrosoftGraphAccessTokenTenantId,
  runGate3d1InboundProvenanceRefresh,
  type Gate3d1GraphThreadEvidence,
} from '@/lib/email/graphSameThreadReplyCore'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { createAdminClient } from '@/lib/supabase/admin'
import { GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE } from '@/lib/strategy/gate3d1-seller-reply-canary'
import { recordOperatingStrategyAttributionQuarantine } from '@/lib/strategy/runtime-governance'
import { logEvent } from '@/lib/system/logEvent'

type GraphMessage = {
  id: string
  conversationId?: string | null
  internetMessageId?: string | null
  subject?: string | null
  bodyPreview?: string | null
  receivedDateTime?: string | null
  from?: { emailAddress?: { address?: string | null; name?: string | null } | null } | null
  toRecipients?: Array<{ emailAddress?: { address?: string | null } | null }>
  isRead?: boolean
  categories?: string[]
  webLink?: string | null
  internetMessageHeaders?: Array<{ name?: string | null; value?: string | null }>
}

type MailboxClassification =
  | 'hot_seller_lead'
  | 'partner_reply'
  | 'spam_noise'
  | 'operational_alert'
  | 'low_priority'

function envBool(name: string, fallback = false) {
  const value = process.env[name]
  if (!value) return fallback
  return /^(1|true|yes|on)$/i.test(value.trim())
}

function mailboxConfig() {
  const clientId = process.env.MICROSOFT_GRAPH_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || ''
  const clientSecret = process.env.MICROSOFT_GRAPH_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || ''
  const refreshToken = process.env.MICROSOFT_GRAPH_REFRESH_TOKEN || process.env.MICROSOFT_REFRESH_TOKEN || ''
  const tenantId = process.env.MICROSOFT_TENANT_ID || ''
  const mailbox = process.env.OUTLOOK_ACQUISITIONS_MAILBOX || 'acquisitions@vestblock.io'
  const mailboxObjectId = process.env.OUTLOOK_ACQUISITIONS_MAILBOX_ID || ''
  const autoCleanSpam = envBool('OUTLOOK_AUTO_CLEAN_SPAM', false)
  const delegatedScopes =
    process.env.MICROSOFT_GRAPH_DELEGATED_SCOPES ||
    [
      'offline_access',
      'https://graph.microsoft.com/User.Read',
      autoCleanSpam
        ? 'https://graph.microsoft.com/Mail.ReadWrite.Shared'
        : 'https://graph.microsoft.com/Mail.Read.Shared',
    ].join(' ')
  const applicationCredentialsReady = Boolean(clientId && clientSecret && tenantId)
  const delegatedCredentialsReady = Boolean(clientId && refreshToken)
  return {
    clientId,
    clientSecret,
    refreshToken,
    tenantId,
    mailbox,
    mailboxObjectId,
    autoCleanSpam,
    delegatedScopes,
    configured: delegatedCredentialsReady || applicationCredentialsReady,
    authMode: refreshToken ? 'delegated_refresh_token' : clientSecret ? 'application_credentials' : 'disconnected',
  }
}

export function getOutlookMailboxStatus() {
  const config = mailboxConfig()
  const gate3d1CallbackScope = getConfiguredGate3d1InboundMailboxScope()
  return {
    configured: config.configured,
    applicationCredentialsReady: Boolean(config.clientId && config.clientSecret && config.tenantId),
    delegatedCredentialsReady: Boolean(config.clientId && config.refreshToken),
    mailbox: config.mailbox,
    authMode: config.authMode,
    autoCleanSpam: config.autoCleanSpam,
    gate3d1CallbackScopeReady: gate3d1CallbackScope.ready,
    gate3d1CallbackScopeBlocker: gate3d1CallbackScope.blocker,
    missing: [
      !config.clientId ? 'MICROSOFT_GRAPH_CLIENT_ID' : null,
      !config.refreshToken && !config.clientSecret
        ? 'MICROSOFT_GRAPH_REFRESH_TOKEN or MICROSOFT_GRAPH_CLIENT_SECRET'
        : null,
      config.clientSecret && !config.refreshToken && !config.tenantId ? 'MICROSOFT_TENANT_ID' : null,
    ].filter(Boolean),
  }
}

async function getMicrosoftAccessToken() {
  const config = mailboxConfig()
  if (!config.configured) throw new Error('Microsoft Graph mailbox credentials are not configured.')

  const body = config.refreshToken
    ? new URLSearchParams({
        client_id: config.clientId,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
        scope: config.delegatedScopes,
        ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
      })
    : new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      })

  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId || 'common')}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.access_token) {
    throw new Error(
      typeof data?.error_description === 'string'
        ? data.error_description
        : `Microsoft token request failed with ${response.status}.`
    )
  }
  const accessToken = data.access_token as string
  let tokenTenantId: string | null = null
  try {
    tokenTenantId = resolveMicrosoftGraphAccessTokenTenantId(accessToken)
  } catch (error) {
    if (envBool('GATE3D1_GRAPH_REPLY_CANARY_ENABLED', false)) throw error
  }
  return { accessToken, tokenTenantId }
}

export async function refreshGate3d1InboundReplyProvenance(input: {
  replyMemoryId: string
  leadId: string
  operatingStrategyVersionId: string
  idempotencyKey: string
}) {
  const expectedTenantId = String(process.env.GATE3D1_GRAPH_TENANT_ID || '').trim()
  const expectedMailboxObjectId = String(process.env.GATE3D1_GRAPH_MAILBOX_OBJECT_ID || '').trim()
  const expectedMailboxAddress = String(process.env.GATE3D1_GRAPH_MAILBOX_ADDRESS || '')
    .trim()
    .toLowerCase()
  const admin = createAdminClient()
  let verifiedAccessToken = ''

  return runGate3d1InboundProvenanceRefresh({
    replyMemoryId: input.replyMemoryId,
    leadId: input.leadId,
    expectedTenantId,
    expectedMailboxObjectId,
    expectedMailboxAddress,
    now: new Date(),
  }, {
    loadExactReply: async ({ replyMemoryId, leadId }) => {
      const [replyResult, leadResult] = await Promise.all([
        admin
          .from('command_center_reply_memory')
          .select('id,lead_id,mailbox,thread_id,message_id,from_email,to_email,subject,reply_summary,property_address,received_at,classification,metadata_json')
          .eq('id', replyMemoryId)
          .eq('lead_id', leadId)
          .limit(2),
        admin
          .from('leads')
          .select('id,email,property_address')
          .eq('id', leadId)
          .limit(2),
      ])
      if (replyResult.error || leadResult.error) {
        throw new Error('The exact inbound reply provenance source could not be loaded safely.')
      }
      if ((replyResult.data || []).length !== 1 || (leadResult.data || []).length !== 1) {
        return null
      }
      const reply = replyResult.data![0]
      const lead = leadResult.data![0]
      const metadata = reply.metadata_json && typeof reply.metadata_json === 'object' && !Array.isArray(reply.metadata_json)
        ? reply.metadata_json as Record<string, unknown>
        : {}
      return {
        id: String(reply.id || ''),
        leadId: String(reply.lead_id || ''),
        leadEmail: String(lead.email || ''),
        leadPropertyAddress: String(lead.property_address || ''),
        mailbox: String(reply.mailbox || ''),
        threadId: String(reply.thread_id || ''),
        messageId: String(reply.message_id || ''),
        fromEmail: String(reply.from_email || ''),
        toEmail: String(reply.to_email || ''),
        subject: String(reply.subject || ''),
        replySummary: String(reply.reply_summary || ''),
        propertyAddress: reply.property_address ? String(reply.property_address) : null,
        receivedAt: String(reply.received_at || ''),
        classification: String(reply.classification || ''),
        metadata,
      }
    },
    getVerifiedReader: async () => {
      const graphSession = await getMicrosoftAccessToken()
      const scope = getConfiguredGate3d1InboundMailboxScope(graphSession.tokenTenantId)
      if (
        !scope.ready ||
        !scope.observedTenantId ||
        !scope.observedMailboxObjectId ||
        !scope.observedMailboxAddress
      ) {
        throw new Error(scope.blocker || 'The actual inbound Microsoft reader scope is not exact.')
      }
      verifiedAccessToken = graphSession.accessToken
      return {
        tenantId: scope.observedTenantId,
        mailboxObjectId: scope.observedMailboxObjectId,
        mailboxAddress: scope.observedMailboxAddress,
      }
    },
    getExactMessage: async ({ reader, sourceMessageId }) => {
      if (!verifiedAccessToken) {
        throw new Error('The verified inbound Microsoft reader session is unavailable.')
      }
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(reader.mailboxObjectId)}/messages/${encodeURIComponent(sourceMessageId)}?$select=id,conversationId,internetMessageId,subject,bodyPreview,receivedDateTime,from,toRecipients`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${verifiedAccessToken}`,
            Prefer: 'IdType="ImmutableId"',
          },
          signal: AbortSignal.timeout(20_000),
        }
      )
      if (response.status === 404) return null
      const message = await response.json().catch(() => ({})) as GraphMessage & {
        error?: { message?: string }
      }
      if (!response.ok) {
        throw new Error(
          typeof message.error?.message === 'string'
            ? message.error.message
            : `Microsoft Graph exact-message read failed with ${response.status}.`
        )
      }
      return {
        id: String(message.id || ''),
        conversationId: String(message.conversationId || ''),
        internetMessageId: String(message.internetMessageId || ''),
        fromAddress: String(message.from?.emailAddress?.address || ''),
        toAddresses: (message.toRecipients || [])
          .map((recipient) => String(recipient.emailAddress?.address || '')),
        subject: String(message.subject || ''),
        bodyPreview: String(message.bodyPreview || ''),
        receivedDateTime: String(message.receivedDateTime || ''),
        preferenceApplied: String(response.headers.get('preference-applied') || ''),
      }
    },
    persistProvenance: async ({
      reply,
      observedTenantId,
      observedMailboxObjectId,
      observedImmutableMessageId,
      preferenceApplied,
    }) => {
      const { data, error } = await admin
        .rpc('refresh_gate3d1_reply_provenance', {
          p_operating_strategy_version_id: input.operatingStrategyVersionId,
          p_reply_memory_id: reply.id,
          p_lead_id: reply.leadId,
          p_expected_stored_message_id: reply.messageId,
          p_expected_conversation_id: reply.threadId,
          p_expected_internet_message_id: String(reply.metadata.internetMessageId || ''),
          p_expected_sender_hash: createHash('sha256')
            .update(reply.fromEmail.trim().toLowerCase())
            .digest('hex'),
          p_expected_recipient_hash: createHash('sha256')
            .update(reply.toEmail.trim().toLowerCase())
            .digest('hex'),
          p_expected_subject: reply.subject,
          p_expected_reply_summary: reply.replySummary,
          p_expected_received_at: reply.receivedAt,
          p_expected_metadata_json: reply.metadata,
          p_observed_tenant_id: observedTenantId,
          p_observed_mailbox_object_id: observedMailboxObjectId,
          p_observed_immutable_message_id: observedImmutableMessageId,
          p_preference_applied: preferenceApplied,
          p_writer_release: GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE,
          p_idempotency_key: input.idempotencyKey,
        })
      const rows = (Array.isArray(data) ? data : data ? [data] : []) as Array<Record<string, unknown>>
      if (error || rows.length !== 1) {
        throw new Error('The exact reply-memory provenance update conflicted and was not applied.')
      }
      const saved = rows[0]
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(saved.refresh_id || '')) ||
        saved.reply_memory_id !== reply.id ||
        saved.lead_id !== reply.leadId ||
        saved.observed_tenant_id !== observedTenantId ||
        saved.observed_mailbox_object_id !== observedMailboxObjectId ||
        saved.observed_immutable_message_id !== observedImmutableMessageId ||
        saved.preference_applied !== preferenceApplied ||
        !/^[0-9a-f]{64}$/.test(String(saved.merged_metadata_fingerprint || '')) ||
        !/^[0-9a-f]{64}$/.test(String(saved.provenance_refresh_fingerprint || ''))
      ) {
        throw new Error('The exact reply-memory provenance update returned conflicting evidence.')
      }
      return {
        refreshId: String(saved.refresh_id),
        mergedMetadataFingerprint: String(saved.merged_metadata_fingerprint),
        provenanceRefreshFingerprint: String(saved.provenance_refresh_fingerprint),
      }
    },
  })
}

async function readExactGate3d1ImmutableCallback(input: {
  accessToken: string
  mailboxObjectId: string
  sourceMessage: GraphMessage
}) {
  const sourceMessageId = String(input.sourceMessage.id || '')
  if (!sourceMessageId || /\s/.test(sourceMessageId)) return null
  const params = new URLSearchParams({
    '$select': 'id,conversationId,internetMessageId,internetMessageHeaders,subject,bodyPreview,receivedDateTime,from,toRecipients',
  })
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(input.mailboxObjectId)}/messages/${encodeURIComponent(sourceMessageId)}?${params}`,
    {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Prefer: 'IdType="ImmutableId"',
      },
      signal: AbortSignal.timeout(20_000),
    }
  )
  if (response.status === 404) return null
  const candidate = await response.json().catch(() => ({})) as GraphMessage & {
    error?: { message?: string }
  }
  if (!response.ok) {
    throw new Error(
      typeof candidate.error?.message === 'string'
        ? candidate.error.message
        : `Microsoft Graph exact callback read failed with ${response.status}.`
    )
  }
  const sourceFrom = cleanText(input.sourceMessage.from?.emailAddress?.address).toLowerCase()
  const candidateFrom = cleanText(candidate.from?.emailAddress?.address).toLowerCase()
  const sourceTo = (input.sourceMessage.toRecipients || [])
    .map((recipient) => cleanText(recipient.emailAddress?.address).toLowerCase())
  const candidateTo = (candidate.toRecipients || [])
    .map((recipient) => cleanText(recipient.emailAddress?.address).toLowerCase())
  if (
    response.headers.get('preference-applied') !== 'IdType=ImmutableId' ||
    !candidate.id ||
    /\s/.test(candidate.id) ||
    candidate.conversationId !== input.sourceMessage.conversationId ||
    candidate.internetMessageId !== input.sourceMessage.internetMessageId ||
    candidate.receivedDateTime !== input.sourceMessage.receivedDateTime ||
    cleanText(candidate.subject) !== cleanText(input.sourceMessage.subject) ||
    cleanText(candidate.bodyPreview) !== cleanText(input.sourceMessage.bodyPreview) ||
    candidateFrom !== sourceFrom ||
    candidateTo.length !== sourceTo.length ||
    candidateTo.some((address, index) => address !== sourceTo[index])
  ) {
    return null
  }
  return candidate
}

async function moveMessageToJunk(input: {
  accessToken: string
  mailbox: string
  messageId: string
}) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(input.mailbox)}/messages/${encodeURIComponent(input.messageId)}/move`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ destinationId: 'junkemail' }),
      signal: AbortSignal.timeout(20_000),
    }
  )
  if (response.ok) return

  const data = await response.json().catch(() => ({}))
  throw new Error(
    typeof data?.error?.message === 'string'
      ? data.error.message
      : `Microsoft Graph junk move failed with ${response.status}.`
  )
}

function cleanText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function exactGraphThreadFromEnrollment(
  enrollment: Record<string, unknown>
): Gate3d1GraphThreadEvidence | null {
  const metadata = enrollment.metadata_json
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>).graphReplyThread
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const thread = raw as Record<string, unknown>
  const result: Gate3d1GraphThreadEvidence = {
    mailboxObjectId: String(thread.mailboxObjectId || ''),
    mailboxAddress: String(thread.mailboxAddress || '').trim().toLowerCase(),
    recipientEmail: String(thread.recipientEmail || '').trim().toLowerCase(),
    targetInboundSourceMessageId: String(thread.targetInboundSourceMessageId || ''),
    targetInboundImmutableMessageId: String(thread.targetInboundImmutableMessageId || ''),
    targetConversationId: String(thread.targetConversationId || ''),
    targetInternetMessageId: String(thread.targetInternetMessageId || ''),
    outboundImmutableMessageId: String(thread.outboundImmutableMessageId || ''),
    outboundInternetMessageId: String(thread.outboundInternetMessageId || ''),
  }
  return Object.values(result).every(Boolean) ? result : null
}

function isAutomaticReply(message: GraphMessage) {
  const subject = cleanText(message.subject).toLowerCase()
  const preview = cleanText(message.bodyPreview).toLowerCase()
  return (
    /\b(automatic reply|auto.?reply|out of office|currently out of (?:the )?office|away from (?:the )?office)\b/.test(subject) ||
    /\b(i am|i'm|we are|we're) currently out of (?:the )?office\b/.test(preview) ||
    /\bwill return on\b/.test(preview)
  )
}

function classifyMessage(message: GraphMessage): MailboxClassification {
  const subject = cleanText(message.subject).toLowerCase()
  const preview = cleanText(message.bodyPreview).toLowerCase()
  const sender = cleanText(message.from?.emailAddress?.address).toLowerCase()
  const combined = `${subject} ${preview}`

  if (
    /\b0rzp4az\b|blood__|community_customs|rod\.ordinary|minerals--|occasionally__|glad--invented/.test(combined) ||
    /pipelinecontentgrowthplus|\.info$/.test(sender) ||
    /salesforce conference|content for your blog|new social media manager|add you to my email list/.test(combined)
  ) return 'spam_noise'
  if (isAutomaticReply(message)) return 'operational_alert'
  if (/dealmachine|export complete|contacts export|delivery failure|undeliverable|mail delivery/.test(combined)) {
    return 'operational_alert'
  }
  if (/buy box|acquisition criteria|actively buying|proof of funds|lending box|builder|developer|partner submission/.test(combined)) {
    return 'partner_reply'
  }
  if (/my house|my property|sell my|selling the|mortgage|foreclosure|asking price|property address|interested in your offer/.test(combined)) {
    return 'hot_seller_lead'
  }
  return 'low_priority'
}

function isExplicitOptOut(message: GraphMessage) {
  return isExplicitEmailOptOutText({
    subject: message.subject,
    bodyPreview: message.bodyPreview,
  })
}

function extractPropertyAddress(text: string) {
  const match = text.match(/\b\d{1,6}\s+[A-Za-z0-9.' -]{2,60}\s(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard|Ct|Court|Way|Pkwy|Parkway)\b/i)
  return match?.[0] || null
}

function nextStepFor(classification: MailboxClassification) {
  if (classification === 'hot_seller_lead') return 'Reply now, confirm property facts and motivation, then route the deal structure.'
  if (classification === 'partner_reply') return 'Capture the buy box or partner criteria and attach it to the relationship record.'
  if (classification === 'operational_alert') return 'Review the operational or automatic response and schedule the appropriate next action.'
  if (classification === 'spam_noise') return 'Keep out of revenue queues; move to Junk when mailbox write access is enabled.'
  return 'Review only if the sender or thread matches an active VestBlock relationship.'
}

async function updateMailboxJob(input: {
  status: 'active' | 'blocked' | 'failed'
  lastStatus: string
  error?: string | null
  metrics?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  await admin
    .from('command_center_jobs')
    .update({
      status: input.status,
      last_status: input.lastStatus,
      last_error: input.error || null,
      last_run_at: new Date().toISOString(),
      next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      metrics_json: input.metrics || {},
      updated_at: new Date().toISOString(),
    })
    .eq('job_key', 'reply-memory-sync')
}

async function recordSellerReplyOutcome(leadId: string, occurredAt: string) {
  const admin = createAdminClient()
  const { data: memberships, error: membershipError } = await admin
    .from('strategy_lead_memberships')
    .update({
      status: 'replied',
      last_outcome_at: occurredAt,
      updated_at: new Date().toISOString(),
    })
    .eq('lead_id', leadId)
    .is('operating_strategy_version_id', null)
    .select('campaign_run_id')
  if (membershipError) throw membershipError

  const { error: enrollmentError } = await admin
    .from('command_center_outbound_enrollments')
    .update({
      status: 'replied',
      updated_at: new Date().toISOString(),
    })
    .eq('lead_id', leadId)
    .eq('channel', 'email')
    .is('operating_strategy_version_id', null)
  if (enrollmentError) throw enrollmentError

  const campaignRunIds = Array.from(
    new Set((memberships || []).map((membership) => membership.campaign_run_id).filter(Boolean))
  ) as string[]
  await Promise.all(
    campaignRunIds.map(async (campaignRunId) => {
      const { count, error: countError } = await admin
        .from('strategy_lead_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_run_id', campaignRunId)
        .eq('status', 'replied')
        .is('operating_strategy_version_id', null)
      if (countError) throw countError

      const { error: runError } = await admin
        .from('command_center_strategy_runs')
        .update({ reply_count: count || 0, updated_at: new Date().toISOString() })
        .eq('id', campaignRunId)
        .is('operating_strategy_version_id', null)
      if (runError) throw runError
    })
  )
}

export async function syncOutlookMailbox(options: {
  dryRun?: boolean
  sinceHours?: number
  limit?: number
  allowProviderMutation?: boolean
} = {}) {
  const config = mailboxConfig()
  const providerMutationAllowed =
    options.allowProviderMutation !== false &&
    !envBool('GATE3D1_CANARY_ISOLATION', false)
  const status = getOutlookMailboxStatus()
  if (!config.configured) {
    if (!options.dryRun) {
      await updateMailboxJob({
        status: 'blocked',
        lastStatus: 'disconnected',
        error: `Missing ${status.missing.join(', ')}`,
      }).catch(() => null)
    }
    return { ok: false, connected: false, ...status, fetched: 0, stored: 0, classifications: {} }
  }

  try {
    const graphSession = await getMicrosoftAccessToken()
    const accessToken = graphSession.accessToken
    const gate3d1CallbackScope = getConfiguredGate3d1InboundMailboxScope(
      graphSession.tokenTenantId
    )
    if (
      envBool('GATE3D1_GRAPH_REPLY_CANARY_ENABLED', false) &&
      !gate3d1CallbackScope.ready
    ) {
      throw new Error(
        gate3d1CallbackScope.blocker ||
          'Gate 3D.1 inbound callback scope could not be verified before mailbox query.'
      )
    }
    const since = new Date(Date.now() - (options.sinceHours || 72) * 60 * 60 * 1000).toISOString()
    const limit = Math.min(Math.max(options.limit || 50, 1), 100)
    const params = new URLSearchParams({
      '$select': 'id,conversationId,internetMessageId,internetMessageHeaders,subject,bodyPreview,receivedDateTime,from,toRecipients,isRead,categories,webLink',
      '$filter': `receivedDateTime ge ${since}`,
      '$orderby': 'receivedDateTime desc',
      '$top': String(limit),
    })
    const mailboxResource = config.mailboxObjectId || config.mailbox
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailboxResource)}/mailFolders/inbox/messages?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(20_000),
      }
    )
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(typeof data?.error?.message === 'string' ? data.error.message : `Microsoft Graph failed with ${response.status}.`)
    }

    const messages = (Array.isArray(data.value) ? data.value : []) as GraphMessage[]
    const admin = createAdminClient()
    const senderEmails = Array.from(new Set(
      messages
        .map((message) => cleanText(message.from?.emailAddress?.address).toLowerCase())
        .filter(Boolean)
    ))
    const [buyerResult, leadResult, lenderResult, investorResult, governedEnrollmentResult] = senderEmails.length
      ? await Promise.all([
          admin.from('buyers').select('id,name,contact_email,relationship_stage,outreach_status').in('contact_email', senderEmails),
          admin.from('leads').select('id,email,name,business_name,property_address,market_segment,category,status').in('email', senderEmails),
          admin.from('lenders').select('id,name,contact_email,relationship_stage,outreach_status').in('contact_email', senderEmails),
          admin.from('investor_profiles').select('id,display_name,contact_email,relationship_stage,outreach_status').in('contact_email', senderEmails),
          admin
            .from('command_center_outbound_enrollments')
            .select('id,lead_id,last_message_id,recipient_hash,operating_strategy_id,operating_strategy_version_id,operating_contract_fingerprint,provider,provider_message_id,canonical_activity_id,metadata_json')
            .eq('channel', 'email')
            .eq('strategy_binding_mode', 'governed_v1')
            .in('recipient', senderEmails),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ]
    if (buyerResult.error) throw buyerResult.error
    if (leadResult.error) throw leadResult.error
    if (lenderResult.error) throw lenderResult.error
    if (investorResult.error) throw investorResult.error
    if (governedEnrollmentResult.error) throw governedEnrollmentResult.error
    const buyersByEmail = new Map((buyerResult.data || []).map((buyer) => [String(buyer.contact_email || '').toLowerCase(), buyer]))
    const leadsByEmail = new Map((leadResult.data || []).map((lead) => [String(lead.email || '').toLowerCase(), lead]))
    const lendersByEmail = new Map((lenderResult.data || []).map((lender) => [String(lender.contact_email || '').toLowerCase(), lender]))
    const investorsByEmail = new Map((investorResult.data || []).map((investor) => [String(investor.contact_email || '').toLowerCase(), investor]))
    const governedEnrollmentsByRecipientHash = new Map<string, typeof governedEnrollmentResult.data>()
    for (const enrollment of governedEnrollmentResult.data || []) {
      const recipientHash = String(enrollment.recipient_hash || '')
      if (!recipientHash) continue
      governedEnrollmentsByRecipientHash.set(recipientHash, [
        ...(governedEnrollmentsByRecipientHash.get(recipientHash) || []),
        enrollment,
      ])
    }
    const classifications: Record<string, number> = {}
    const rows = []
    const confirmedSpamMessageIds: string[] = []
    const buyerReplies: Array<{ buyerId: string; buyerName: string; email: string; messageId: string }> = []
    const lenderReplies: Array<{ lenderId: string; lenderName: string; email: string; messageId: string }> = []
    const investorReplies: Array<{ investorId: string; investorName: string; email: string; messageId: string }> = []
    const optOuts = new Set<string>()

    for (const message of messages) {
      const preview = cleanText(message.bodyPreview).slice(0, 600)
      const fromEmail = cleanText(message.from?.emailAddress?.address).toLowerCase() || null
      let buyer = fromEmail ? buyersByEmail.get(fromEmail) : null
      const lead = fromEmail ? leadsByEmail.get(fromEmail) : null
      const lender = fromEmail ? lendersByEmail.get(fromEmail) : null
      const investor = fromEmail ? investorsByEmail.get(fromEmail) : null
      const explicitOptOut = isExplicitOptOut(message)
      let classification = classifyMessage(message)
      if (!explicitOptOut && !['spam_noise', 'operational_alert'].includes(classification)) {
        if (buyer || lender || investor) classification = 'partner_reply'
        else if (lead) {
          classification = isGate3d1FounderReviewableSellerReplyText({
            subject: message.subject,
            bodyPreview: message.bodyPreview,
          })
            ? 'hot_seller_lead'
            : 'low_priority'
        }
      }
      classifications[classification] = (classifications[classification] || 0) + 1
      if (classification === 'spam_noise') confirmedSpamMessageIds.push(message.id)

      if (
        !options.dryRun &&
        classification === 'partner_reply' &&
        fromEmail &&
        isUsableContactEmail(fromEmail) &&
        !buyer
      ) {
        const senderName = cleanText(message.from?.emailAddress?.name) || fromEmail.split('@')[0]
        buyer = await upsertBuyer({
          name: senderName,
          buyerType: 'local_operator',
          category: 'local_cash_buyer',
          contactEmail: fromEmail,
          contactName: senderName,
          source: 'outlook_partner_reply',
          sourceUrl: message.webLink || null,
          externalId: `outlook:${fromEmail}`,
          fitSummary: 'Inbound partner reply received in the VestBlock acquisitions mailbox; buy box still needs confirmation.',
          metadata: { mailbox: config.mailbox, messageId: message.id },
        })
        buyersByEmail.set(fromEmail, buyer)
      }

      if (classification === 'partner_reply' && buyer?.id && fromEmail) {
        buyerReplies.push({ buyerId: buyer.id, buyerName: buyer.name, email: fromEmail, messageId: message.id })
      }
      if (classification === 'partner_reply' && lender?.id && fromEmail) {
        lenderReplies.push({ lenderId: lender.id, lenderName: lender.name, email: fromEmail, messageId: message.id })
      }
      if (classification === 'partner_reply' && investor?.id && fromEmail) {
        investorReplies.push({ investorId: investor.id, investorName: investor.display_name, email: fromEmail, messageId: message.id })
      }
      if (fromEmail && explicitOptOut) optOuts.add(fromEmail)

      rows.push({
        lead_id: lead?.id || null,
        strategy_key: buyer?.id
          ? 'buyer-network'
          : lender?.id
            ? 'lender-network'
            : investor?.id
              ? 'investor-network'
              : lead?.market_segment || lead?.category || null,
        mailbox: config.mailbox,
        thread_id: message.conversationId || null,
        message_id: message.id,
        from_email: fromEmail,
        to_email: cleanText(message.toRecipients?.[0]?.emailAddress?.address).toLowerCase() || config.mailbox,
        subject: cleanText(message.subject).slice(0, 240) || '(no subject)',
        property_address: extractPropertyAddress(`${message.subject || ''} ${message.bodyPreview || ''}`),
        market: null,
        received_at: message.receivedDateTime || new Date().toISOString(),
        classification,
        next_step: nextStepFor(classification),
        reply_summary: preview || 'No message preview was returned by Outlook.',
        metadata_json: {
          internetMessageId: message.internetMessageId || null,
          senderName: cleanText(message.from?.emailAddress?.name) || null,
          isRead: Boolean(message.isRead),
          categories: message.categories || [],
          webLink: message.webLink || null,
          syncSource: 'microsoft_graph',
          buyerId: buyer?.id || null,
          lenderId: lender?.id || null,
          investorId: investor?.id || null,
          explicitOptOut,
        },
      })
    }

    let stored = 0
    let newMessages = 0
    let movedSpam = 0
    let spamMoveFailures = 0
    if (!options.dryRun && rows.length) {
      const messageIds = rows.map((row) => row.message_id)
      const { data: existingRows, error: existingError } = await admin
        .from('command_center_reply_memory')
        .select('message_id')
        .eq('mailbox', config.mailbox)
        .in('message_id', messageIds)
      if (existingError) throw existingError
      const existingMessageIds = new Set((existingRows || []).map((row) => String(row.message_id)))
      const newMessageIds = new Set(messageIds.filter((messageId) => !existingMessageIds.has(messageId)))
      newMessages = newMessageIds.size

      // Persist every explicit suppression before governed attribution. A STOP
      // reply must close outreach first; only then may its exact callback be
      // recorded as a suppressed outcome for the already-pinned enrollment.
      const newOptOutEmails = new Set(
        rows
          .filter((row) => newMessageIds.has(row.message_id) && row.metadata_json.explicitOptOut && row.from_email)
          .map((row) => String(row.from_email).toLowerCase())
      )
      for (const email of newOptOutEmails) {
        const { data: existingSuppression, error: suppressionLookupError } = await admin
          .from('lead_suppressions')
          .select('id')
          .eq('email', email)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()
        if (suppressionLookupError) throw suppressionLookupError
        if (!existingSuppression?.id) {
          const { error: suppressionInsertError } = await admin
            .from('lead_suppressions')
            .insert({ email, reason: 'Explicit email opt-out received in Outlook.' })
          if (suppressionInsertError) throw suppressionInsertError
        }
        const suppressionWrites = await Promise.all([
          admin.from('leads').update({ delivery_status: 'suppressed', suppression_reason: 'Explicit email opt-out.' }).eq('email', email),
          admin.from('buyers').update({ outreach_status: 'do_not_contact' }).eq('contact_email', email),
          admin.from('lenders').update({ outreach_status: 'do_not_contact', next_follow_up_at: null }).eq('contact_email', email),
          admin.from('investor_profiles').update({ outreach_status: 'do_not_contact', next_follow_up_at: null }).eq('contact_email', email),
          admin
            .from('command_center_outbound_enrollments')
            .update({ status: 'suppressed', suppression_reason: 'Explicit email opt-out.', next_action_at: null, updated_at: new Date().toISOString() })
            .eq('recipient', email)
            .eq('channel', 'email')
            .is('operating_strategy_version_id', null),
        ])
        const suppressionWriteError = suppressionWrites.find((result) => result.error)?.error
        if (suppressionWriteError) throw suppressionWriteError
      }

      for (const row of rows.filter((item) => newMessageIds.has(item.message_id) && item.from_email)) {
        const senderEmailHash = createHash('sha256')
          .update(String(row.from_email).trim().toLowerCase())
          .digest('hex')
        const candidates = governedEnrollmentsByRecipientHash.get(senderEmailHash) || []
        if (!candidates.length) continue
        const originalMessage = messages.find((message) => message.id === row.message_id)
        const occurredAt = row.received_at || new Date().toISOString()
        const hasGate3d1Candidate = candidates.some((candidate) => {
          const metadata = candidate.metadata_json
          return metadata && typeof metadata === 'object' && !Array.isArray(metadata) &&
            (metadata as Record<string, unknown>).deliveryMode === 'gate3d1_exact_same_thread_canary'
        })
        let immutableCallbackMessage: GraphMessage | null = null
        if (
          hasGate3d1Candidate &&
          gate3d1CallbackScope.ready &&
          gate3d1CallbackScope.observedMailboxObjectId &&
          originalMessage
        ) {
          try {
            immutableCallbackMessage = await readExactGate3d1ImmutableCallback({
              accessToken,
              mailboxObjectId: gate3d1CallbackScope.observedMailboxObjectId,
              sourceMessage: originalMessage,
            })
          } catch (error) {
            console.warn(
              '[outlook-mailbox] exact Gate 3D.1 callback identity read failed closed:',
              error instanceof Error ? error.message : String(error)
            )
          }
        }
        const callbackMessage = hasGate3d1Candidate
          ? immutableCallbackMessage
          : originalMessage || null
        const exactCandidates = gate3d1CallbackScope.ready &&
          gate3d1CallbackScope.observedMailboxObjectId &&
          gate3d1CallbackScope.observedMailboxAddress &&
          callbackMessage
          ? candidates.filter((candidate) => {
              const thread = exactGraphThreadFromEnrollment(candidate as Record<string, unknown>)
              return Boolean(thread && isExactGate3d1GraphReplyCallback({
                mailboxObjectId: gate3d1CallbackScope.observedMailboxObjectId!,
                mailboxAddress: gate3d1CallbackScope.observedMailboxAddress!,
                immutableMessageId: callbackMessage.id,
                conversationId: String(callbackMessage.conversationId || ''),
                internetMessageId: String(callbackMessage.internetMessageId || ''),
                fromAddress: String(callbackMessage.from?.emailAddress?.address || ''),
                toAddresses: (callbackMessage.toRecipients || [])
                  .map((recipient) => String(recipient.emailAddress?.address || '')),
                internetMessageHeaders: (callbackMessage.internetMessageHeaders || [])
                  .map((header) => ({
                    name: String(header.name || ''),
                    value: String(header.value || ''),
                  })),
              }, thread))
            })
          : []
        if (exactCandidates.length === 1) {
          const exactEnrollment = exactCandidates[0]
          const thread = exactGraphThreadFromEnrollment(exactEnrollment as Record<string, unknown>)!
          const outcome = await recordStrategyDeliveryOutcome({
            leadId: exactEnrollment.lead_id || null,
            messageId: exactEnrollment.last_message_id,
            enrollmentId: exactEnrollment.id,
            operatingStrategyVersionId: exactEnrollment.operating_strategy_version_id,
            provider: 'outlook_graph',
            providerMessageId: thread.outboundImmutableMessageId,
            providerEventId: callbackMessage!.id,
            status: row.metadata_json.explicitOptOut === true ? 'suppressed' : 'replied',
            occurredAt,
          })
          if (!outcome.updated) {
            throw new Error(`Exact governed Outlook reply attribution failed: ${outcome.reason}.`)
          }
          continue
        }
        const evidence = {
          mailbox_hash: createHash('sha256').update(config.mailbox.toLowerCase()).digest('hex'),
          graph_message_id: row.message_id,
          graph_conversation_id_hash: originalMessage?.conversationId
            ? createHash('sha256').update(originalMessage.conversationId).digest('hex')
            : null,
          internet_message_id_hash: originalMessage?.internetMessageId
            ? createHash('sha256').update(originalMessage.internetMessageId).digest('hex')
            : null,
          sender_email_hash: senderEmailHash,
          classification: row.classification,
          explicit_opt_out: row.metadata_json.explicitOptOut === true,
          occurred_at: occurredAt,
        }
        const payloadHash = createHash('sha256').update(JSON.stringify(evidence)).digest('hex')
        const quarantineId = await recordOperatingStrategyAttributionQuarantine({
          sourceDomain: 'outlook_mailbox',
          sourceEventKey: `${evidence.mailbox_hash}:${row.message_id}`,
          reasonCode: exactCandidates.length > 1 || candidates.length > 1
            ? 'ambiguous_governed_enrollment'
            : 'provider_identity_missing',
          identifiers: evidence,
          candidateBindings: candidates.map((candidate) => ({
            outbound_enrollment_id: candidate.id,
            operating_strategy_id: candidate.operating_strategy_id,
            operating_strategy_version_id: candidate.operating_strategy_version_id,
            operating_contract_fingerprint: candidate.operating_contract_fingerprint,
            provider: candidate.provider,
            provider_message_id: candidate.provider_message_id,
            canonical_activity_id: candidate.canonical_activity_id,
            recipient_hash: candidate.recipient_hash,
          })),
          payloadHash,
          occurredAt,
          writerRelease: hasGate3d1Candidate
            ? GATE3D1_SELLER_REPLY_CANARY_WRITER_RELEASE
            : undefined,
        })
        const attributionTask = await createAdminTask({
          title: 'Reconcile governed Outlook reply attribution',
          description: 'An inbound Outlook message matched one or more governed recipients, but no exact immutable outbound thread identity proved which enrollment owns it. Review the quarantined evidence before updating any governed strategy outcome.',
          taskType: 'governed_reply_attribution_review',
          priority: row.metadata_json.explicitOptOut ? 'urgent' : 'high',
          entityType: 'attribution_quarantine',
          entityId: quarantineId,
          dueAt: adminTaskDueDates.now(),
          metadata: {
            quarantineId,
            graphMessageId: row.message_id,
            candidateCount: candidates.length,
            explicitOptOut: row.metadata_json.explicitOptOut === true,
          },
        })
        if (!attributionTask.ok || !attributionTask.task?.id) {
          throw new Error(attributionTask.error || 'Governed Outlook attribution task could not be created.')
        }
      }

      const rowsToInsert = rows.filter((row) => newMessageIds.has(row.message_id))
      const { data: saved, error } = rowsToInsert.length
        ? await admin
        .from('command_center_reply_memory')
        .upsert(rowsToInsert, {
          onConflict: 'mailbox,message_id',
          ignoreDuplicates: true,
        })
        .select('id')
        : { data: [], error: null }
      if (error) throw error
      stored = saved?.length || 0

      for (const reply of buyerReplies.filter((item) => newMessageIds.has(item.messageId))) {
        await updateBuyerRecord(reply.buyerId, {
          relationship_stage: 'responded',
          outreach_status: 'responded',
          next_follow_up_at: new Date().toISOString(),
        })
        await createAdminTask({
          title: `Capture buyer buy box: ${reply.buyerName}`,
          description: 'A buyer or partner replied in the acquisitions mailbox. Review the thread, capture markets, asset types, price range, condition tolerance, close speed, and acceptable deal structures before routing properties.',
          taskType: 'buyer_reply_buy_box_capture',
          priority: 'urgent',
          entityType: 'buyer',
          entityId: reply.buyerId,
          userEmail: reply.email,
          dueAt: adminTaskDueDates.now(),
          metadata: { messageId: reply.messageId, mailbox: config.mailbox },
        })
        await admin.from('buyer_relationship_events').insert({
          buyer_id: reply.buyerId,
          event_type: 'responded',
          metadata_json: { messageId: reply.messageId, mailbox: config.mailbox },
        })
      }

      for (const reply of lenderReplies.filter((item) => newMessageIds.has(item.messageId))) {
        const [{ error: lenderError }, { error: eventError }] = await Promise.all([
          admin
            .from('lenders')
            .update({
              relationship_stage: 'responded',
              outreach_status: 'responded',
              next_follow_up_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', reply.lenderId),
          admin.from('lender_relationship_events').insert({
            lender_id: reply.lenderId,
            event_type: 'responded',
            metadata_json: { messageId: reply.messageId, mailbox: config.mailbox },
          }),
        ])
        if (lenderError) throw lenderError
        if (eventError) throw eventError
        await createAdminTask({
          title: `Capture lender box: ${reply.lenderName}`,
          description: 'A lender replied in the acquisitions mailbox. Capture states served, deal types, leverage limits, borrower requirements, exclusions, close speed, and the correct submission process.',
          taskType: 'lender_reply_box_capture',
          priority: 'urgent',
          entityType: 'lender',
          entityId: reply.lenderId,
          userEmail: reply.email,
          dueAt: adminTaskDueDates.now(),
          metadata: { messageId: reply.messageId, mailbox: config.mailbox },
        })
      }

      for (const reply of investorReplies.filter((item) => newMessageIds.has(item.messageId))) {
        const [{ error: investorError }, { error: eventError }] = await Promise.all([
          admin
            .from('investor_profiles')
            .update({
              relationship_stage: 'responded',
              outreach_status: 'responded',
              next_follow_up_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', reply.investorId),
          admin.from('investor_engagement_events').insert({
            investor_profile_id: reply.investorId,
            event_type: 'reply',
            event_value: 'mailbox_reply',
            metadata_json: { messageId: reply.messageId, mailbox: config.mailbox },
          }),
        ])
        if (investorError) throw investorError
        if (eventError) throw eventError
        await createAdminTask({
          title: `Capture investor buy box: ${reply.investorName}`,
          description: 'An investor or capital partner replied in the acquisitions mailbox. Capture markets, asset types, price range, condition tolerance, close speed, structures, proof-of-funds path, and submission instructions.',
          taskType: 'investor_reply_buy_box_capture',
          priority: 'urgent',
          entityType: 'investor_profile',
          entityId: reply.investorId,
          userEmail: reply.email,
          dueAt: adminTaskDueDates.now(),
          metadata: { messageId: reply.messageId, mailbox: config.mailbox },
        })
      }

      for (const lead of leadsByEmail.values()) {
        if (!lead?.id || optOuts.has(String(lead.email || '').toLowerCase())) continue
        const sellerReply = rows.find(
          (row) =>
            newMessageIds.has(row.message_id) &&
            row.lead_id === lead.id &&
            !['spam_noise', 'operational_alert'].includes(row.classification)
        )
        if (sellerReply) {
          await admin
            .from('leads')
            .update({
              status: 'replied',
              outreach_status: 'followup_due',
              delivery_status: 'replied',
              next_follow_up_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id)
          await recordSellerReplyOutcome(lead.id, sellerReply.received_at || new Date().toISOString())
          await createAdminTask({
            title: `Qualify seller reply: ${lead.property_address || lead.name || lead.business_name || lead.id}`,
            description: 'A seller replied in the acquisitions mailbox. Confirm authority to sell, condition, occupancy, timeline, asking price, loan balance, liens, access, and whether cash, seller finance, subject-to, novation, or a hybrid path is acceptable. Mark qualified only after the material facts are captured.',
            taskType: 'seller_reply_qualification',
            priority: 'urgent',
            entityType: 'lead',
            entityId: lead.id,
            userEmail: lead.email || null,
            dueAt: adminTaskDueDates.now(),
            metadata: {
              messageId: sellerReply.message_id,
              mailbox: config.mailbox,
              propertyAddress: lead.property_address || sellerReply.property_address || null,
            },
          })
        }
      }

      const partnerReplyEmails = new Set(
        rows
          .filter((row) => newMessageIds.has(row.message_id) && row.classification === 'partner_reply' && row.from_email)
          .map((row) => String(row.from_email).toLowerCase())
      )
      for (const email of partnerReplyEmails) {
        const { error: enrollmentError } = await admin
          .from('command_center_outbound_enrollments')
          .update({ status: 'replied', next_action_at: null, updated_at: new Date().toISOString() })
          .eq('recipient', email)
          .eq('channel', 'email')
          .is('operating_strategy_version_id', null)
        if (enrollmentError) throw enrollmentError
      }

      if (config.autoCleanSpam && providerMutationAllowed) {
        for (const messageId of confirmedSpamMessageIds) {
          try {
            await moveMessageToJunk({ accessToken, mailbox: config.mailbox, messageId })
            movedSpam += 1
          } catch (error) {
            spamMoveFailures += 1
            console.warn(
              '[outlook-mailbox] confirmed spam move failed:',
              error instanceof Error ? error.message : String(error)
            )
          }
        }
      }
      await updateMailboxJob({
        status: 'active',
        lastStatus: 'completed',
        metrics: {
          fetched: messages.length,
          stored,
          newMessages,
          classifications,
          autoCleanSpam: config.autoCleanSpam && providerMutationAllowed,
          movedSpam,
          spamMoveFailures,
        },
      })
      await logEvent({
        eventType: 'admin_action',
        entityType: 'mailbox',
        entityId: config.mailbox,
        metadata: {
          action: 'outlook_reply_memory_sync',
          fetched: messages.length,
          stored,
          newMessages,
          classifications,
          autoCleanSpam: config.autoCleanSpam && providerMutationAllowed,
          movedSpam,
          spamMoveFailures,
        },
      })
    }

    return {
      ok: true,
      connected: true,
      ...status,
      fetched: messages.length,
      stored,
      newMessages,
      classifications,
      movedSpam,
      spamMoveFailures,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!options.dryRun) {
      await updateMailboxJob({ status: 'failed', lastStatus: 'failed', error: message }).catch(() => null)
    }
    return { ok: false, connected: false, ...status, error: message, fetched: 0, stored: 0, classifications: {} }
  }
}
