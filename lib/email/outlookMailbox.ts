import 'server-only'

import { randomUUID } from 'node:crypto'

import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { updateBuyerRecord, upsertBuyer } from '@/lib/buyers/repository'
import type { BuyerRecord } from '@/lib/buyers/types'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { recordOutreachThroughputProviderOutcome } from '@/lib/outreach/throughputGovernor'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'
import {
  correlateOutlookInbound,
  evaluateOutlookInboundIntegrity,
  requireOutlookThroughputProjectionUpdated,
  selectCorrelatedLead,
  shouldProcessMailboxSideEffects,
  type MailboxClassification,
  type OutlookInboundMessage,
  type OutlookOutboundEvidence,
} from '@/lib/email/outlookMailboxIntegrity'
import {
  buildOutlookMailboxInitialUrl,
  validateOutlookMailboxContinuationUrl,
} from '@/lib/email/outlookMailboxPaginationCore'

const OUTBOUND_SEND_STATUSES = ['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied']
const EVIDENCE_PAGE_SIZE = 500

type GraphMessage = OutlookInboundMessage & {
  receivedDateTime?: string | null
  toRecipients?: Array<{ emailAddress?: { address?: string | null } | null }>
  isRead?: boolean
  categories?: string[]
  webLink?: string | null
}

type LeadMatch = {
  id: string
  email: string | null
  name: string | null
  business_name: string | null
  property_address: string | null
  market_segment: string | null
  category: string | null
  status: string | null
}

type LenderMatch = {
  id: string
  name: string
  contact_email: string | null
  relationship_stage: string | null
  outreach_status: string | null
}

type InvestorMatch = {
  id: string
  display_name: string
  contact_email: string | null
  relationship_stage: string | null
  outreach_status: string | null
}

type ReplyMemoryRow = {
  lead_id: string | null
  strategy_key: string | null
  mailbox: string
  thread_id: string | null
  message_id: string
  from_email: string | null
  to_email: string
  subject: string
  property_address: string | null
  market: null
  received_at: string
  classification: MailboxClassification
  next_step: string
  reply_summary: string
  metadata_json: Record<string, unknown>
}

type MailboxAction = {
  row: ReplyMemoryRow
  pending: boolean
  buyer: BuyerRecord | null
  lead: LeadMatch | null
  lender: LenderMatch | null
  investor: InvestorMatch | null
}

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
    autoCleanSpam,
    delegatedScopes,
    configured: delegatedCredentialsReady || applicationCredentialsReady,
    authMode: refreshToken ? 'delegated_refresh_token' : clientSecret ? 'application_credentials' : 'disconnected',
  }
}

export function getOutlookMailboxStatus() {
  const config = mailboxConfig()
  return {
    configured: config.configured,
    mailbox: config.mailbox,
    authMode: config.authMode,
    autoCleanSpam: config.autoCleanSpam,
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
  return data.access_token as string
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

async function hydrateMessageHeaders(input: {
  accessToken: string
  mailbox: string
  messages: GraphMessage[]
}) {
  const hydrated = new Map<string, GraphMessage['internetMessageHeaders']>()
  for (let offset = 0; offset < input.messages.length; offset += 20) {
    const batch = input.messages.slice(offset, offset + 20)
    const response = await fetch('https://graph.microsoft.com/v1.0/$batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: batch.map((message, index) => ({
          id: String(index),
          method: 'GET',
          url: `/users/${encodeURIComponent(input.mailbox)}/messages/${encodeURIComponent(message.id)}?$select=internetMessageHeaders`,
        })),
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !Array.isArray(data.responses)) {
      throw new Error(`Microsoft Graph header batch failed with ${response.status}.`)
    }
    for (const item of data.responses) {
      const batchIndex = Number(item?.id)
      const message = batch[batchIndex]
      if (!message || Number(item?.status) < 200 || Number(item?.status) >= 300) {
        throw new Error('Microsoft Graph could not load integrity headers for an inbox message.')
      }
      hydrated.set(
        message.id,
        Array.isArray(item?.body?.internetMessageHeaders) ? item.body.internetMessageHeaders : []
      )
    }
  }
  return input.messages.map((message) => ({
    ...message,
    internetMessageHeaders: hydrated.get(message.id) || [],
  }))
}

async function loadOutboundEnrollmentRows(
  admin: ReturnType<typeof createAdminClient>,
  senderEmails: string[]
) {
  const rows: Array<Record<string, unknown>> = []
  for (let offset = 0; ; offset += EVIDENCE_PAGE_SIZE) {
    const { data, error } = await admin
      .from('command_center_outbound_enrollments')
      .select('lead_id,strategy_key,recipient,last_message_id,metadata_json,created_at,updated_at,status')
      .eq('channel', 'email')
      .in('status', OUTBOUND_SEND_STATUSES)
      .in('recipient', senderEmails)
      .range(offset, offset + EVIDENCE_PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...((data || []) as Array<Record<string, unknown>>))
    if ((data || []).length < EVIDENCE_PAGE_SIZE) break
  }
  return rows
}

async function loadOutboundSendEventRows(
  admin: ReturnType<typeof createAdminClient>,
  senderEmails: string[]
) {
  const rows: Array<Record<string, unknown>> = []
  for (let offset = 0; ; offset += EVIDENCE_PAGE_SIZE) {
    const { data, error } = await admin
      .from('outreach_send_events')
      .select('lead_id,outreach_message_id,recipient,provider,metadata_json,created_at,status')
      .eq('channel', 'email')
      .in('status', OUTBOUND_SEND_STATUSES)
      .in('recipient', senderEmails)
      .range(offset, offset + EVIDENCE_PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...((data || []) as Array<Record<string, unknown>>))
    if ((data || []).length < EVIDENCE_PAGE_SIZE) break
  }
  return rows
}

function metadataTimestamp(metadata: Record<string, unknown>, fallback: unknown) {
  for (const key of ['providerAcceptedAt', 'provider_accepted_at', 'sentAt', 'sent_at', 'createdAt', 'created_at']) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return typeof fallback === 'string' ? fallback : null
}

function hasEnrollmentSendEvidence(row: Record<string, unknown>) {
  if (typeof row.last_message_id === 'string' && row.last_message_id.trim()) return true
  const metadata = (row.metadata_json || {}) as Record<string, unknown>
  return Boolean(metadataTimestamp(metadata, null))
}

function cleanText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim()
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
  claimToken?: string | null
}) {
  const admin = createAdminClient()
  const nextRunAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  if (input.claimToken) {
    const { data, error } = await admin.rpc('finalize_outlook_mailbox_sync', {
      p_job_key: 'reply-memory-sync',
      p_claim_token: input.claimToken,
      p_status: input.status,
      p_last_status: input.lastStatus,
      p_error: input.error || null,
      p_metrics: input.metrics || {},
      p_replace_metrics: input.metrics !== undefined,
      p_next_run_at: nextRunAt,
    })
    if (error) throw error
    const result = (data || {}) as { updated?: boolean; reason?: string | null }
    if (!result.updated) {
      throw new Error(`Reply-memory job lease ownership was lost: ${result.reason || 'unknown_reason'}`)
    }
    return
  }
  const { data, error } = await admin
    .from('command_center_jobs')
    .update({
      status: input.status,
      last_status: input.lastStatus,
      last_error: input.error || null,
      last_run_at: new Date().toISOString(),
      next_run_at: nextRunAt,
      ...(input.metrics !== undefined ? { metrics_json: input.metrics } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('job_key', 'reply-memory-sync')
    .select('job_key')
  if (error) throw error
  if (!data?.length) throw new Error('Reply-memory job status row was not updated.')
}

type MailboxSyncCursorState = {
  continuationUrl: string | null
  highWatermark: string | null
  windowStartedAt: string | null
}

function validMailboxCursorTimestamp(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + 5 * 60_000) return null
  return new Date(timestamp).toISOString()
}

function mailboxSyncCursorStateFromMetrics(
  metricsValue: unknown,
  mailbox: string
): MailboxSyncCursorState {
  const metrics = (metricsValue || {}) as Record<string, unknown>
  const rawContinuation = metrics.continuationUrl
  const continuationUrl = rawContinuation == null || rawContinuation === ''
    ? null
    : validateOutlookMailboxContinuationUrl(rawContinuation, mailbox)
  // Invalid persisted URLs are ignored rather than followed. The next safe
  // completed run overwrites the corrupt value while retaining a validated
  // high-watermark starting point.
  return {
    continuationUrl,
    highWatermark: validMailboxCursorTimestamp(metrics.highWatermark),
    windowStartedAt: validMailboxCursorTimestamp(metrics.windowStartedAt),
  }
}

async function loadMailboxSyncCursorState(
  admin: ReturnType<typeof createAdminClient>,
  mailbox: string
): Promise<MailboxSyncCursorState> {
  const { data, error } = await admin
    .from('command_center_jobs')
    .select('metrics_json')
    .eq('job_key', 'reply-memory-sync')
    .maybeSingle()
  if (error) throw error
  return mailboxSyncCursorStateFromMetrics(data?.metrics_json, mailbox)
}

async function claimMailboxSyncLease(input: {
  admin: ReturnType<typeof createAdminClient>
  mailbox: string
  claimToken: string
}) {
  const { data, error } = await input.admin.rpc('claim_outlook_mailbox_sync', {
    p_job_key: 'reply-memory-sync',
    p_claim_token: input.claimToken,
    p_lease_seconds: 600,
  })
  if (error) throw error
  const result = (data || {}) as {
    claimed?: boolean
    reason?: string | null
    metrics?: Record<string, unknown>
  }
  return {
    ...result,
    cursorState: mailboxSyncCursorStateFromMetrics(result.metrics, input.mailbox),
  }
}

async function claimMailboxSideEffects(input: {
  admin: ReturnType<typeof createAdminClient>
  mailbox: string
  messageId: string
}) {
  const claimToken = randomUUID()
  const { data, error } = await input.admin.rpc('claim_outlook_mailbox_side_effects', {
    p_mailbox: input.mailbox,
    p_message_id: input.messageId,
    p_claim_token: claimToken,
    p_lease_seconds: 600,
  })
  if (error) throw error
  const result = (data || {}) as { claimed?: boolean; reason?: string | null }
  return { ...result, claimToken }
}

async function requireAdminTask(input: Parameters<typeof createAdminTask>[0]) {
  const result = await createAdminTask(input)
  if (!result.ok) throw new Error(result.error || 'Admin reply task write failed.')
}

async function ensureBuyerReplyEvent(input: {
  buyerId: string
  messageId: string
  mailbox: string
}) {
  const admin = createAdminClient()
  const { data: existing, error: lookupError } = await admin
    .from('buyer_relationship_events')
    .select('id')
    .eq('buyer_id', input.buyerId)
    .eq('event_type', 'responded')
    .contains('metadata_json', { messageId: input.messageId })
    .limit(1)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing?.id) return
  const { error } = await admin.from('buyer_relationship_events').insert({
    buyer_id: input.buyerId,
    event_type: 'responded',
    metadata_json: { messageId: input.messageId, mailbox: input.mailbox },
  })
  if (error) throw error
}

async function ensureLenderReplyEvent(input: {
  lenderId: string
  messageId: string
  mailbox: string
}) {
  const admin = createAdminClient()
  const { data: existing, error: lookupError } = await admin
    .from('lender_relationship_events')
    .select('id')
    .eq('lender_id', input.lenderId)
    .eq('event_type', 'responded')
    .contains('metadata_json', { messageId: input.messageId })
    .limit(1)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing?.id) return
  const { error } = await admin.from('lender_relationship_events').insert({
    lender_id: input.lenderId,
    event_type: 'responded',
    metadata_json: { messageId: input.messageId, mailbox: input.mailbox },
  })
  if (error) throw error
}

async function ensureInvestorReplyEvent(input: {
  investorId: string
  messageId: string
  mailbox: string
}) {
  const admin = createAdminClient()
  const { data: existing, error: lookupError } = await admin
    .from('investor_engagement_events')
    .select('id')
    .eq('investor_profile_id', input.investorId)
    .eq('event_type', 'reply')
    .contains('metadata_json', { messageId: input.messageId })
    .limit(1)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (existing?.id) return
  const { error } = await admin.from('investor_engagement_events').insert({
    investor_profile_id: input.investorId,
    event_type: 'reply',
    event_value: 'mailbox_reply',
    metadata_json: { messageId: input.messageId, mailbox: input.mailbox },
  })
  if (error) throw error
}

async function archivePendingEmailMessages(input: {
  leadIds: string[]
  buyerIds: string[]
  lenderIds: string[]
  investorIds: string[]
}) {
  const admin = createAdminClient()
  const mutations: Array<PromiseLike<{ error: { message?: string } | null }>> = []
  if (input.leadIds.length) {
    mutations.push(
      admin
        .from('outreach_messages')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .in('lead_id', input.leadIds)
        .eq('channel', 'email')
        .in('status', ['approved', 'needs_review', 'queued'])
    )
  }
  if (input.buyerIds.length) {
    mutations.push(
      admin
        .from('buyer_outreach_messages')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .in('buyer_id', input.buyerIds)
        .in('channel', ['email_intro', 'email_followup', 'spanish_email'])
        .in('status', ['approved', 'needs_review', 'queued'])
    )
  }
  if (input.lenderIds.length) {
    mutations.push(
      admin
        .from('lender_outreach_messages')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .in('lender_id', input.lenderIds)
        .in('channel', ['email_intro', 'email_followup', 'spanish_email'])
        .in('status', ['approved', 'needs_review', 'queued'])
    )
  }
  if (input.investorIds.length) {
    mutations.push(
      admin
        .from('investor_outreach_messages')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .in('investor_profile_id', input.investorIds)
        .eq('channel', 'email')
        .in('status', ['approved', 'needs_review', 'queued'])
    )
  }

  const results = await Promise.all(mutations)
  const error = results.find((result) => result.error)?.error
  if (error) throw new Error(error.message || 'Pending opt-out message cancellation failed.')
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
      if (countError) throw countError

      const { error: runError } = await admin
        .from('command_center_strategy_runs')
        .update({ reply_count: count || 0, updated_at: new Date().toISOString() })
        .eq('id', campaignRunId)
      if (runError) throw runError
    })
  )
}

export async function syncOutlookMailbox(options: {
  dryRun?: boolean
  sinceHours?: number
  limit?: number
} = {}) {
  const config = mailboxConfig()
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

  let syncLeaseClaimed = false
  let syncClaimToken: string | null = null
  try {
    const admin = createAdminClient()
    const proposedSyncClaimToken = randomUUID()
    syncClaimToken = proposedSyncClaimToken
    const cursorState = options.dryRun
      ? await loadMailboxSyncCursorState(admin, config.mailbox)
      : await (async () => {
          const claim = await claimMailboxSyncLease({
            admin,
            mailbox: config.mailbox,
            claimToken: proposedSyncClaimToken,
          })
          if (!claim.claimed) {
            if (claim.reason === 'mailbox_sync_claim_active') return null
            throw new Error(`Mailbox sync could not be claimed: ${claim.reason || 'unknown_reason'}`)
          }
          syncLeaseClaimed = true
          return claim.cursorState
        })()
    if (!cursorState) {
      return {
        ok: false,
        connected: true,
        ...status,
        error: 'mailbox_sync_claim_active',
        fetched: 0,
        stored: 0,
        classifications: {},
      }
    }
    const accessToken = await getMicrosoftAccessToken()
    const overlapMinutes = 15
    const since = cursorState.highWatermark
      ? new Date(Date.parse(cursorState.highWatermark) - overlapMinutes * 60_000).toISOString()
      : new Date(Date.now() - (options.sinceHours || 72) * 60 * 60 * 1000).toISOString()
    const limit = Math.min(Math.max(options.limit || 100, 1), 250)
    const savedContinuationUrl = cursorState.continuationUrl
    const windowStartedAt = savedContinuationUrl && cursorState.windowStartedAt
      ? cursorState.windowStartedAt
      : new Date().toISOString()
    let pageUrl = savedContinuationUrl || buildOutlookMailboxInitialUrl({
      mailbox: config.mailbox,
      since,
      pageSize: Math.min(50, limit),
    })
    const runStartPageUrl = pageUrl
    const seenPageUrls = new Set<string>()
    const baseMessages: GraphMessage[] = []
    let pagesFetched = 0
    let continuationUrl: string | null = null

    while (pageUrl && baseMessages.length < limit) {
      const validatedPageUrl = validateOutlookMailboxContinuationUrl(pageUrl, config.mailbox)
      if (!validatedPageUrl) throw new Error('Microsoft Graph mailbox continuation URL failed validation.')
      if (seenPageUrls.has(validatedPageUrl)) {
        throw new Error('Microsoft Graph mailbox pagination repeated the same continuation URL.')
      }
      seenPageUrls.add(validatedPageUrl)

      const response = await fetch(validatedPageUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20_000),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          typeof data?.error?.message === 'string'
            ? data.error.message
            : `Microsoft Graph failed with ${response.status}.`
        )
      }

      const pageMessages = (Array.isArray(data.value) ? data.value : []) as GraphMessage[]
      // Consume the entire Graph page. A continuation points after the whole
      // page, so slicing a final partial page would permanently skip its tail.
      baseMessages.push(...pageMessages)
      pagesFetched += 1
      const rawNextLink = data?.['@odata.nextLink']
      continuationUrl = rawNextLink == null
        ? null
        : validateOutlookMailboxContinuationUrl(rawNextLink, config.mailbox)
      if (rawNextLink != null && !continuationUrl) {
        throw new Error('Microsoft Graph returned an invalid mailbox continuation URL.')
      }
      pageUrl = continuationUrl || ''
    }

    const backlogPending = Boolean(continuationUrl)
    const messages = await hydrateMessageHeaders({
      accessToken,
      mailbox: config.mailbox,
      messages: baseMessages,
    })
    const senderEmails = Array.from(new Set(
      messages
        .map((message) => cleanText(message.from?.emailAddress?.address).toLowerCase())
        .filter(Boolean)
    ))
    const [buyerResult, leadResult, lenderResult, investorResult, enrollmentRows, sendEventRows] = senderEmails.length
      ? await Promise.all([
          admin.from('buyers').select('id,name,contact_email,relationship_stage,outreach_status').in('contact_email', senderEmails),
          admin.from('leads').select('id,email,name,business_name,property_address,market_segment,category,status').in('email', senderEmails),
          admin.from('lenders').select('id,name,contact_email,relationship_stage,outreach_status').in('contact_email', senderEmails),
          admin.from('investor_profiles').select('id,display_name,contact_email,relationship_stage,outreach_status').in('contact_email', senderEmails),
          loadOutboundEnrollmentRows(admin, senderEmails),
          loadOutboundSendEventRows(admin, senderEmails),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          [],
          [],
        ]
    if (buyerResult.error) throw buyerResult.error
    if (leadResult.error) throw leadResult.error
    if (lenderResult.error) throw lenderResult.error
    if (investorResult.error) throw investorResult.error
    const buyersByEmail = new Map(
      (buyerResult.data || []).map((buyer) => [String(buyer.contact_email || '').toLowerCase(), buyer as BuyerRecord])
    )
    const leads = (leadResult.data || []) as LeadMatch[]
    const lendersByEmail = new Map(
      (lenderResult.data || []).map((lender) => [String(lender.contact_email || '').toLowerCase(), lender as LenderMatch])
    )
    const investorsByEmail = new Map(
      (investorResult.data || []).map((investor) => [String(investor.contact_email || '').toLowerCase(), investor as InvestorMatch])
    )
    const outboundEvidence: OutlookOutboundEvidence[] = [
      ...enrollmentRows.filter(hasEnrollmentSendEvidence).map((row) => {
        const metadata = (row.metadata_json || {}) as Record<string, unknown>
        return {
        source: 'enrollment' as const,
        leadId: typeof row.lead_id === 'string' ? row.lead_id : null,
        strategyKey: typeof row.strategy_key === 'string' ? row.strategy_key : null,
          recipient: cleanText(typeof row.recipient === 'string' ? row.recipient : null).toLowerCase() || null,
        outboundMessageId: typeof row.last_message_id === 'string' ? row.last_message_id : null,
        providerMessageId:
          typeof metadata.providerMessageId === 'string'
            ? metadata.providerMessageId
            : typeof metadata.provider_message_id === 'string'
              ? metadata.provider_message_id
              : null,
        provider:
          typeof metadata.provider === 'string'
            ? metadata.provider
            : typeof metadata.sendProvider === 'string'
              ? metadata.sendProvider
              : typeof metadata.send_provider === 'string'
                ? metadata.send_provider
                : null,
        occurredAt: metadataTimestamp(metadata, row.created_at),
        metadata,
      }}),
      ...sendEventRows.map((row) => {
        const metadata = (row.metadata_json || {}) as Record<string, unknown>
        return {
        source: 'send_event' as const,
        leadId: typeof row.lead_id === 'string' ? row.lead_id : null,
        strategyKey: null,
          recipient: cleanText(typeof row.recipient === 'string' ? row.recipient : null).toLowerCase() || null,
        outboundMessageId: typeof row.outreach_message_id === 'string' ? row.outreach_message_id : null,
        providerMessageId:
          typeof metadata.providerMessageId === 'string'
            ? metadata.providerMessageId
            : typeof metadata.provider_message_id === 'string'
              ? metadata.provider_message_id
              : null,
        provider:
          typeof row.provider === 'string'
            ? row.provider
            : typeof metadata.provider === 'string'
              ? metadata.provider
              : typeof metadata.sendProvider === 'string'
                ? metadata.sendProvider
                : typeof metadata.send_provider === 'string'
                  ? metadata.send_provider
                  : null,
        occurredAt: metadataTimestamp(metadata, row.created_at),
        metadata,
      }}),
    ]
    const messageIds = messages.map((message) => message.id)
    const { data: existingRows, error: existingError } = messageIds.length
      ? await admin
          .from('command_center_reply_memory')
          .select('message_id,metadata_json')
          .eq('mailbox', config.mailbox)
          .in('message_id', messageIds)
      : { data: [], error: null }
    if (existingError) throw existingError
    const existingMetadataByMessageId = new Map(
      (existingRows || []).map((row) => [
        String(row.message_id),
        (row.metadata_json || {}) as Record<string, unknown>,
      ])
    )
    const classifications: Record<string, number> = {}
    const rows: ReplyMemoryRow[] = []
    const actions: MailboxAction[] = []
    const confirmedSpamMessageIds: string[] = []

    for (const message of messages) {
      const preview = cleanText(message.bodyPreview).slice(0, 600)
      const fromEmail = cleanText(message.from?.emailAddress?.address).toLowerCase() || null
      let buyer = fromEmail ? buyersByEmail.get(fromEmail) || null : null
      const lender = fromEmail ? lendersByEmail.get(fromEmail) || null : null
      const investor = fromEmail ? investorsByEmail.get(fromEmail) || null : null
      const outboundCorrelation = correlateOutlookInbound(message, fromEmail, outboundEvidence)
      const lead = selectCorrelatedLead({ leads, fromEmail, correlation: outboundCorrelation })
      const integrity = evaluateOutlookInboundIntegrity({
        message,
        correlation: outboundCorrelation,
        relationships: {
          buyer: Boolean(buyer),
          lead: Boolean(lead),
          lender: Boolean(lender),
          investor: Boolean(investor),
        },
      })
      const { classification, explicitOptOut } = integrity
      classifications[classification] = (classifications[classification] || 0) + 1
      if (classification === 'spam_noise') confirmedSpamMessageIds.push(message.id)
      const existingMetadata = existingMetadataByMessageId.get(message.id) || {}
      const pending = shouldProcessMailboxSideEffects({
        metadata: existingMetadata,
        actionableReply: integrity.actionableReply,
        allowSuppression: integrity.allowSuppression,
      })

      if (
        !options.dryRun &&
        pending &&
        integrity.allowBuyerCreation &&
        fromEmail &&
        isUsableContactEmail(fromEmail) &&
        !buyer &&
        !lender &&
        !investor
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

      const row: ReplyMemoryRow = {
        lead_id: lead?.id || null,
        strategy_key:
          outboundCorrelation.strategyKey ||
          (buyer?.id
            ? 'buyer-network'
            : lender?.id
              ? 'lender-network'
              : investor?.id
                ? 'investor-network'
                : lead?.market_segment || lead?.category || null),
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
        next_step: integrity.manualReviewRequired
          ? 'Review sender authentication and thread evidence manually; no CRM or suppression changes were applied.'
          : nextStepFor(classification),
        reply_summary: preview || 'No message preview was returned by Outlook.',
        metadata_json: {
          ...existingMetadata,
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
          bulkMail: integrity.bulkMail,
          correlatedOutbound: integrity.correlated,
          actionableReply: integrity.actionableReply,
          suppressionAuthorized: integrity.allowSuppression,
          correlationType: outboundCorrelation.matchType || null,
          correlationStateChangeAuthorized: integrity.stateChangeAuthorized,
          manualReviewRequired: integrity.manualReviewRequired,
          senderAuthentication: integrity.senderAuthentication,
          correlatedOutboundMessageId: outboundCorrelation.outboundMessageId || null,
          correlatedOutboundProvider: outboundCorrelation.provider || null,
          correlatedProviderMessageId: outboundCorrelation.providerMessageId || null,
          correlatedOutboundOccurredAt: outboundCorrelation.occurredAt || null,
        },
      }
      rows.push(row)
      actions.push({ row, pending, buyer, lead, lender, investor })
    }

    let stored = 0
    let newMessages = 0
    let movedSpam = 0
    let spamMoveFailures = 0
    let sideEffectClaimsDeferred = 0
    if (!options.dryRun && rows.length) {
      const existingMessageIds = new Set((existingRows || []).map((row) => String(row.message_id)))
      const newMessageIds = new Set(messageIds.filter((messageId) => !existingMessageIds.has(messageId)))
      newMessages = newMessageIds.size

      // Existing records are immutable inbound evidence. Avoid overwriting a
      // concurrent worker's processing claim with metadata read before that
      // claim; only insert messages that were not present at query time.
      const newRows = rows.filter((row) => newMessageIds.has(row.message_id))
      const { data: saved, error } = newRows.length
        ? await admin
        .from('command_center_reply_memory')
        .upsert(newRows, {
          onConflict: 'mailbox,message_id',
          ignoreDuplicates: true,
        })
        .select('id')
        : { data: [], error: null }
      if (error) throw error
      stored = saved?.length || 0

      for (const action of actions.filter((candidate) => candidate.pending)) {
        const { row, buyer, lead, lender, investor } = action
        const claim = await claimMailboxSideEffects({
          admin,
          mailbox: config.mailbox,
          messageId: row.message_id,
        })
        if (!claim.claimed) {
          if (claim.reason === 'mailbox_side_effects_already_completed') continue
          if (claim.reason === 'mailbox_side_effects_claim_active') {
            sideEffectClaimsDeferred += 1
            continue
          }
          throw new Error(`Mailbox side effects could not be claimed: ${claim.reason || 'unknown_reason'}`)
        }
        const email = row.from_email
        const actionableReply = row.metadata_json.actionableReply === true
        const suppressionAuthorized = row.metadata_json.suppressionAuthorized === true
        let throughputReplyTracking: Record<string, unknown> = { attempted: false }

        if (actionableReply && row.classification === 'partner_reply' && email) {
          if (buyer?.id) {
            await updateBuyerRecord(buyer.id, {
              relationship_stage: 'responded',
              outreach_status: 'responded',
              next_follow_up_at: new Date().toISOString(),
            })
            await ensureBuyerReplyEvent({
              buyerId: buyer.id,
              messageId: row.message_id,
              mailbox: config.mailbox,
            })
            await requireAdminTask({
              title: `Capture buyer buy box: ${buyer.name}`,
              description: 'A buyer or partner replied in the acquisitions mailbox. Review the thread, capture markets, asset types, price range, condition tolerance, close speed, and acceptable deal structures before routing properties.',
              taskType: 'buyer_reply_buy_box_capture',
              priority: 'urgent',
              entityType: 'buyer',
              entityId: buyer.id,
              userEmail: email,
              dueAt: adminTaskDueDates.now(),
              metadata: { messageId: row.message_id, mailbox: config.mailbox },
            })
          }
          if (lender?.id) {
            const { data: updatedLenders, error: lenderError } = await admin
              .from('lenders')
              .update({
                relationship_stage: 'responded',
                outreach_status: 'responded',
                next_follow_up_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', lender.id)
              .select('id')
            if (lenderError) throw lenderError
            if (!updatedLenders?.length) throw new Error('Lender reply target was not updated.')
            await ensureLenderReplyEvent({
              lenderId: lender.id,
              messageId: row.message_id,
              mailbox: config.mailbox,
            })
            await requireAdminTask({
              title: `Capture lender box: ${lender.name}`,
              description: 'A lender replied in the acquisitions mailbox. Capture states served, deal types, leverage limits, borrower requirements, exclusions, close speed, and the correct submission process.',
              taskType: 'lender_reply_box_capture',
              priority: 'urgent',
              entityType: 'lender',
              entityId: lender.id,
              userEmail: email,
              dueAt: adminTaskDueDates.now(),
              metadata: { messageId: row.message_id, mailbox: config.mailbox },
            })
          }
          if (investor?.id) {
            const { data: updatedInvestors, error: investorError } = await admin
              .from('investor_profiles')
              .update({
                relationship_stage: 'responded',
                outreach_status: 'responded',
                next_follow_up_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', investor.id)
              .select('id')
            if (investorError) throw investorError
            if (!updatedInvestors?.length) throw new Error('Investor reply target was not updated.')
            await ensureInvestorReplyEvent({
              investorId: investor.id,
              messageId: row.message_id,
              mailbox: config.mailbox,
            })
            await requireAdminTask({
              title: `Capture investor buy box: ${investor.display_name}`,
              description: 'An investor or capital partner replied in the acquisitions mailbox. Capture markets, asset types, price range, condition tolerance, close speed, structures, proof-of-funds path, and submission instructions.',
              taskType: 'investor_reply_buy_box_capture',
              priority: 'urgent',
              entityType: 'investor_profile',
              entityId: investor.id,
              userEmail: email,
              dueAt: adminTaskDueDates.now(),
              metadata: { messageId: row.message_id, mailbox: config.mailbox },
            })
          }

          const { error: enrollmentError } = await admin
            .from('command_center_outbound_enrollments')
            .update({ status: 'replied', next_action_at: null, updated_at: new Date().toISOString() })
            .eq('recipient', email)
            .eq('channel', 'email')
          if (enrollmentError) throw enrollmentError
        }

        if (actionableReply && row.classification === 'hot_seller_lead' && lead?.id) {
          const { data: updatedLeads, error: leadError } = await admin
            .from('leads')
            .update({
              status: 'replied',
              outreach_status: 'followup_due',
              delivery_status: 'replied',
              next_follow_up_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id)
            .select('id')
          if (leadError) throw leadError
          if (!updatedLeads?.length) throw new Error('Seller reply target was not updated.')
          await recordSellerReplyOutcome(lead.id, row.received_at)
          await requireAdminTask({
            title: `Qualify seller reply: ${lead.property_address || lead.name || lead.business_name || lead.id}`,
            description: 'A seller replied in the acquisitions mailbox. Confirm authority to sell, condition, occupancy, timeline, asking price, loan balance, liens, access, and whether cash, seller finance, subject-to, novation, or a hybrid path is acceptable. Mark qualified only after the material facts are captured.',
            taskType: 'seller_reply_qualification',
            priority: 'urgent',
            entityType: 'lead',
            entityId: lead.id,
            userEmail: lead.email,
            dueAt: adminTaskDueDates.now(),
            metadata: {
              messageId: row.message_id,
              mailbox: config.mailbox,
              propertyAddress: lead.property_address || row.property_address,
            },
          })
        }

        if (suppressionAuthorized) {
          if (!email) throw new Error('A correlated opt-out is missing the sender address.')
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
          const [leadMutation, buyerMutation, lenderMutation, investorMutation, enrollmentMutation] =
            await Promise.all([
            admin
              .from('leads')
              .update({ delivery_status: 'suppressed', suppression_reason: 'Explicit email opt-out.' })
              .eq('email', email)
              .select('id'),
            admin
              .from('buyers')
              .update({ outreach_status: 'do_not_contact' })
              .eq('contact_email', email)
              .select('id'),
            admin
              .from('lenders')
              .update({ outreach_status: 'do_not_contact', next_follow_up_at: null })
              .eq('contact_email', email)
              .select('id'),
            admin
              .from('investor_profiles')
              .update({ outreach_status: 'do_not_contact', next_follow_up_at: null })
              .eq('contact_email', email)
              .select('id'),
            admin
              .from('command_center_outbound_enrollments')
              .update({
                status: 'suppressed',
                suppression_reason: 'Explicit email opt-out.',
                next_action_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('recipient', email)
              .eq('channel', 'email'),
          ])
          const suppressionError = [
            leadMutation,
            buyerMutation,
            lenderMutation,
            investorMutation,
            enrollmentMutation,
          ].find((result) => result.error)?.error
          if (suppressionError) throw suppressionError
          await archivePendingEmailMessages({
            leadIds: (leadMutation.data || []).map((record) => String(record.id)),
            buyerIds: (buyerMutation.data || []).map((record) => String(record.id)),
            lenderIds: (lenderMutation.data || []).map((record) => String(record.id)),
            investorIds: (investorMutation.data || []).map((record) => String(record.id)),
          })
        }

        const correlatedProviderMessageId = row.metadata_json.correlatedProviderMessageId
        const correlatedOutboundProvider = row.metadata_json.correlatedOutboundProvider
        if (
          (actionableReply || suppressionAuthorized) &&
          typeof correlatedProviderMessageId === 'string' &&
          correlatedProviderMessageId.trim()
        ) {
          try {
            if (
              typeof correlatedOutboundProvider !== 'string' ||
              !correlatedOutboundProvider.trim()
            ) {
              throw new Error('A correlated provider message is missing its outbound provider.')
            }
            const result = await recordOutreachThroughputProviderOutcome({
              provider: correlatedOutboundProvider.trim().toLowerCase(),
              providerMessageId: correlatedProviderMessageId,
              state: suppressionAuthorized ? 'suppressed' : 'replied',
              metadata: {
                mailbox: config.mailbox,
                replyMessageId: row.message_id,
                receivedAt: row.received_at,
                suppressionAuthorized,
              },
            })
            requireOutlookThroughputProjectionUpdated(result)
            throughputReplyTracking = { attempted: true, ok: true, result }
          } catch (error) {
            throughputReplyTracking = {
              attempted: true,
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }
            console.error('[outlook-mailbox] throughput reply reconciliation failed', error)
            // Suppression/reply mutations above are idempotent. Leave the
            // mailbox side-effect marker incomplete so this authoritative
            // throughput outcome is retried on the next ingestion pass.
            throw error
          }
        }

        const completedAt = new Date().toISOString()
        const completedMetadata = {
          ...row.metadata_json,
          throughputReplyTracking,
          mailboxSideEffects: { status: 'completed', completedAt, version: 1 },
        }
        const { data: completedRows, error: completionError } = await admin
          .from('command_center_reply_memory')
          .update({ metadata_json: completedMetadata, updated_at: completedAt })
          .eq('mailbox', config.mailbox)
          .eq('message_id', row.message_id)
          .contains('metadata_json', {
            mailboxSideEffects: { status: 'processing', claimToken: claim.claimToken },
          })
          .select('id')
        if (completionError) throw completionError
        if (!completedRows?.length) throw new Error('Mailbox side-effect completion marker was not saved.')
        row.metadata_json = completedMetadata
      }

      if (config.autoCleanSpam) {
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
    }

    const ingestionPending = backlogPending || sideEffectClaimsDeferred > 0
    // If a message claim was observed in-flight, replay from the beginning of
    // this run after the lease instead of advancing beyond that message.
    const persistedContinuationUrl = sideEffectClaimsDeferred > 0
      ? runStartPageUrl
      : continuationUrl
    const syncMetrics = {
      fetched: messages.length,
      pagesFetched,
      resumedContinuation: Boolean(savedContinuationUrl),
      backlogPending,
      highWatermark: ingestionPending ? cursorState.highWatermark : windowStartedAt,
      ...(ingestionPending ? { windowStartedAt } : {}),
      sideEffectClaimsDeferred,
      ...(persistedContinuationUrl ? { continuationUrl: persistedContinuationUrl } : {}),
      stored,
      newMessages,
      classifications,
      autoCleanSpam: config.autoCleanSpam,
      movedSpam,
      spamMoveFailures,
    }
    if (!options.dryRun) {
      await updateMailboxJob({
        status: ingestionPending ? 'blocked' : 'active',
        lastStatus: backlogPending
          ? 'backlog_pending'
          : sideEffectClaimsDeferred > 0
            ? 'side_effects_pending'
            : 'completed',
        error: backlogPending
          ? `Mailbox reply ingestion has more than ${limit} messages pending; outbound remains paused until the saved continuation is drained.`
          : sideEffectClaimsDeferred > 0
            ? `${sideEffectClaimsDeferred} mailbox message(s) are being processed by another run; outbound remains paused until completion is confirmed.`
            : null,
        metrics: syncMetrics,
        claimToken: syncClaimToken,
      })
      await logEvent({
        eventType: 'admin_action',
        entityType: 'mailbox',
        entityId: config.mailbox,
        metadata: {
          action: 'outlook_reply_memory_sync',
          ...syncMetrics,
          continuationUrl: persistedContinuationUrl ? '[persisted]' : null,
        },
      })
    }

    return {
      ok: !ingestionPending,
      connected: true,
      ...status,
      fetched: messages.length,
      stored,
      newMessages,
      classifications,
      movedSpam,
      spamMoveFailures,
      pagesFetched,
      resumedContinuation: Boolean(savedContinuationUrl),
      backlogPending,
      sideEffectClaimsDeferred,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!options.dryRun && syncLeaseClaimed) {
      await updateMailboxJob({
        status: 'failed',
        lastStatus: 'failed',
        error: message,
        claimToken: syncClaimToken,
      }).catch(() => null)
    }
    return { ok: false, connected: false, ...status, error: message, fetched: 0, stored: 0, classifications: {} }
  }
}
