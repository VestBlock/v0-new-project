import 'server-only'

import { createHash } from 'node:crypto'

import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { updateBuyerRecord, upsertBuyer } from '@/lib/buyers/repository'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { createAdminClient } from '@/lib/supabase/admin'
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

function cleanText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim()
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
  const combined = `${cleanText(message.subject)} ${cleanText(message.bodyPreview)}`
  return /\b(unsubscribe|do not contact|don't contact|stop emailing|stop contacting|opt[ -]?out|remove me)\b/i.test(combined)
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

  try {
    const accessToken = await getMicrosoftAccessToken()
    const since = new Date(Date.now() - (options.sinceHours || 72) * 60 * 60 * 1000).toISOString()
    const limit = Math.min(Math.max(options.limit || 50, 1), 100)
    const params = new URLSearchParams({
      '$select': 'id,conversationId,internetMessageId,subject,bodyPreview,receivedDateTime,from,toRecipients,isRead,categories,webLink',
      '$filter': `receivedDateTime ge ${since}`,
      '$orderby': 'receivedDateTime desc',
      '$top': String(limit),
    })
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.mailbox)}/mailFolders/inbox/messages?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000) }
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
            .select('id,recipient_hash,operating_strategy_id,operating_strategy_version_id,operating_contract_fingerprint,provider,provider_message_id,canonical_activity_id')
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
        else if (lead) classification = 'hot_seller_lead'
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

      for (const row of rows.filter((item) => newMessageIds.has(item.message_id) && item.from_email)) {
        const senderEmailHash = createHash('sha256')
          .update(String(row.from_email).trim().toLowerCase())
          .digest('hex')
        const candidates = governedEnrollmentsByRecipientHash.get(senderEmailHash) || []
        if (!candidates.length) continue
        const originalMessage = messages.find((message) => message.id === row.message_id)
        const occurredAt = row.received_at || new Date().toISOString()
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
          reasonCode: candidates.length > 1
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

      const { data: saved, error } = await admin
        .from('command_center_reply_memory')
        .upsert(rows, { onConflict: 'mailbox,message_id' })
        .select('id')
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

      const newOptOutEmails = new Set(
        rows
          .filter((row) => newMessageIds.has(row.message_id) && row.metadata_json.explicitOptOut && row.from_email)
          .map((row) => String(row.from_email).toLowerCase())
      )
      for (const email of newOptOutEmails) {
        const { data: existingSuppression } = await admin
          .from('lead_suppressions')
          .select('id')
          .eq('email', email)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()
        if (!existingSuppression?.id) {
          await admin.from('lead_suppressions').insert({ email, reason: 'Explicit email opt-out received in Outlook.' })
        }
        await admin.from('leads').update({ delivery_status: 'suppressed', suppression_reason: 'Explicit email opt-out.' }).eq('email', email)
        await admin.from('buyers').update({ outreach_status: 'do_not_contact' }).eq('contact_email', email)
        await admin.from('lenders').update({ outreach_status: 'do_not_contact', next_follow_up_at: null }).eq('contact_email', email)
        await admin.from('investor_profiles').update({ outreach_status: 'do_not_contact', next_follow_up_at: null }).eq('contact_email', email)
        await admin
          .from('command_center_outbound_enrollments')
          .update({ status: 'suppressed', suppression_reason: 'Explicit email opt-out.', next_action_at: null, updated_at: new Date().toISOString() })
          .eq('recipient', email)
          .eq('channel', 'email')
          .is('operating_strategy_version_id', null)
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
      await updateMailboxJob({
        status: 'active',
        lastStatus: 'completed',
        metrics: {
          fetched: messages.length,
          stored,
          newMessages,
          classifications,
          autoCleanSpam: config.autoCleanSpam,
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
          autoCleanSpam: config.autoCleanSpam,
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
