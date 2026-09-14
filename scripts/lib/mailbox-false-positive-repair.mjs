const REPLY_TASK_TYPES = new Set([
  'buyer_reply_buy_box_capture',
  'lender_reply_box_capture',
  'lender_reply_criteria_capture',
  'investor_reply_buy_box_capture',
  'seller_reply_qualification',
])

const OUTBOUND_STATUSES = new Set(['accepted', 'sent', 'delivered', 'opened', 'clicked', 'replied'])
const REPLY_WINDOW_MS = 120 * 24 * 60 * 60 * 1000
const RECIPIENT_FALLBACK_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function isDirectOptOut(row) {
  if (row?.metadata_json?.bulkMail === true) return false
  const subject = cleanText(row.subject).replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, '').trim()
  const preview = cleanText(row.reply_summary).slice(0, 280)
  const optOutRequest =
    '(?:unsubscribe(?:\\s+me)?|remove me(?:\\s+from\\s+(?:your|the)\\s+(?:list|emails?))?|take me off(?:\\s+(?:your|the)\\s+(?:list|emails?))?|opt(?:\\s+me)?[ -]?out|do not (?:(?:contact|email) me(?:\\s+again)?|send me(?:\\s+any)?(?:\\s+more)?\\s+emails?)|don[\'’]t (?:(?:contact|email) me(?:\\s+again)?|send me(?:\\s+any)?(?:\\s+more)?\\s+emails?)|stop(?:\\s+(?:emailing|contacting)(?:\\s+me)?)?|not interested(?:\\s*[,;:-]?\\s*(?:please\\s+)?stop)?|i (?:want|would like) to opt[ -]?out)'
  const directSubject = new RegExp(
    `^(?:(?:please|kindly)\\s+)?${optOutRequest}(?:\\s+(?:please|thanks|thank you))?[.!]?$`,
    'i'
  )
  const directPreview = new RegExp(
    `^(?:(?:hi|hello|thanks|thank you|no thanks|no thank you)[,!.]?\\s+(?:but\\s+)?)*(?:(?:please|kindly)\\s+)?${optOutRequest}(?=[.!]|\\s+(?:and|please)\\b|$)`,
    'i'
  )
  return directSubject.test(subject) || directPreview.test(preview)
}

function isCampaignLike(row) {
  const text = `${cleanText(row.subject)} ${cleanText(row.reply_summary)}`.toLowerCase()
  const campaignSignal = /\b(newsletter|weekly (?:news|digest|update)|this week|read more|view (?:this email )?in (?:your )?browser|manage (?:email )?preferences|you (?:are|were) receiving this email|unsubscribe|webinar|register now|limited time|special offer|product update|community update|tiktok shop|google cloud|google for startups|startup school|colosseum|solana foundation|ai automation builders?|live builds every|claim your spot|zero setup fee|million dollar math problem|paid before you build|website operating system)\b/.test(text)
  const datedNewsletter = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+20\d{2}\b/.test(text) && /\b(?:howdy|newsletter|agents?|developers?|website|project|members?)\b/.test(text)
  const classifierSignal = /buy box|acquisition criteria|actively buying|proof of funds|lending box|builder|developer|partner submission|my house|my property|sell my|selling the|mortgage|foreclosure|asking price|property address|interested in your offer/.test(text)
  const metadata = row.metadata_json || {}
  return Boolean(metadata.bulkMail || campaignSignal || datedNewsletter || (classifierSignal && /unsubscribe|manage preferences|read more/i.test(text)))
}

export function isFooterFalseOptOut(row) {
  const metadata = row.metadata_json || {}
  if (!metadata.explicitOptOut || isDirectOptOut(row)) return false
  const text = `${cleanText(row.subject)} ${cleanText(row.reply_summary)}`.toLowerCase()
  return /unsubscribe|manage (?:email )?preferences|you (?:are|were) receiving this email|reply (?:with )?["'“”]?opt[ -]?out|if this is not relevant/.test(text)
}

function messageIdFromTask(task) {
  const value = task?.metadata_json?.messageId
  return typeof value === 'string' ? value : null
}

function metadataString(metadata, keys) {
  for (const key of keys) {
    const value = metadata?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizeMessageIdentifier(value) {
  return cleanText(value).replace(/^mailto:/i, '').replace(/^<|>$/g, '').toLowerCase()
}

function identifiersMatch(left, right) {
  const normalizedLeft = normalizeMessageIdentifier(left)
  const normalizedRight = normalizeMessageIdentifier(right)
  if (!normalizedLeft || !normalizedRight) return false
  if (normalizedLeft === normalizedRight) return true
  const leftLocal = normalizedLeft.includes('@')
    ? normalizedLeft.slice(0, normalizedLeft.indexOf('@'))
    : normalizedLeft
  const rightLocal = normalizedRight.includes('@')
    ? normalizedRight.slice(0, normalizedRight.indexOf('@'))
    : normalizedRight
  return leftLocal.length >= 8 && rightLocal.length >= 8 && leftLocal === rightLocal
}

function timestamp(value) {
  const parsed = Date.parse(cleanText(value))
  return Number.isFinite(parsed) ? parsed : null
}

function outboundOccurredAt(row) {
  return (
    metadataString(row.metadata_json, [
      'providerAcceptedAt',
      'provider_accepted_at',
      'sentAt',
      'sent_at',
      'createdAt',
      'created_at',
    ]) ||
    row.created_at ||
    row.updated_at ||
    null
  )
}

function outboundIdentifiers(row) {
  return [
    row.last_message_id,
    row.outreach_message_id,
    metadataString(row.metadata_json, ['providerMessageId', 'provider_message_id']),
    metadataString(row.metadata_json, ['internetMessageId', 'internet_message_id']),
    metadataString(row.metadata_json, ['messageId', 'message_id']),
  ].filter(Boolean)
}

function hasVerifiableSendEvidence(row) {
  if (!Object.prototype.hasOwnProperty.call(row, 'last_message_id')) return true
  return Boolean(
    row.last_message_id ||
      metadataString(row.metadata_json, [
        'providerMessageId',
        'provider_message_id',
        'providerAcceptedAt',
        'provider_accepted_at',
        'sentAt',
        'sent_at',
      ])
  )
}

export function hasPriorOutboundCorrelation(replyRow, outboundRows) {
  const receivedAt = timestamp(replyRow.received_at)
  if (receivedAt === null) return false
  const lowerBound = receivedAt - REPLY_WINDOW_MS
  const eligible = outboundRows.filter((outbound) => {
    if (!OUTBOUND_STATUSES.has(String(outbound.status || '').toLowerCase())) return false
    if (!hasVerifiableSendEvidence(outbound)) return false
    const occurredAt = timestamp(outboundOccurredAt(outbound))
    return occurredAt !== null && occurredAt <= receivedAt && occurredAt >= lowerBound
  })
  if (!eligible.length) return false

  const metadata = replyRow.metadata_json || {}
  const correlatedOutboundMessageId = metadataString(metadata, ['correlatedOutboundMessageId'])
  if (
    correlatedOutboundMessageId &&
    eligible.some((outbound) =>
      outboundIdentifiers(outbound).some((identifier) =>
        identifiersMatch(correlatedOutboundMessageId, identifier)
      )
    )
  ) {
    return true
  }

  const correlationId = metadataString(metadata, ['correlationId', 'correlation_id'])
  if (
    correlationId &&
    eligible.some(
      (outbound) =>
        normalizeMessageIdentifier(
          metadataString(outbound.metadata_json, [
            'correlationId',
            'correlation_id',
            'outreachCorrelationId',
            'outreach_correlation_id',
          ])
        ) === normalizeMessageIdentifier(correlationId)
    )
  ) {
    return true
  }

  const threadId = cleanText(replyRow.thread_id)
  if (
    threadId &&
    eligible.some((outbound) => {
      const outboundThreadId = metadataString(outbound.metadata_json, [
        'conversationId',
        'conversation_id',
        'threadId',
        'thread_id',
      ])
      return outboundThreadId === threadId
    })
  ) {
    return true
  }

  const sender = normalizeEmail(replyRow.from_email)
  return Boolean(
    sender &&
      eligible.some(
        (outbound) =>
          timestamp(outboundOccurredAt(outbound)) >= receivedAt - RECIPIENT_FALLBACK_WINDOW_MS &&
          normalizeEmail(outbound.recipient) === sender
      )
  )
}

function hasIntegrityRepairMarker(row) {
  return row?.metadata_json?.integrityRepair?.reason === 'uncorrelated_campaign_like_inbound'
}

function hasFooterRepairMarker(row) {
  return row?.metadata_json?.integrityRepair?.outlookFooterFalseOptOut === true
}

export function buildMailboxFalsePositiveRepairPlan(input) {
  const replyRows = Array.isArray(input.replyRows) ? input.replyRows : []
  const outboundRows = Array.isArray(input.outboundRows) ? input.outboundRows : []
  const tasks = Array.isArray(input.tasks) ? input.tasks : []
  const suppressions = Array.isArray(input.suppressions) ? input.suppressions : []
  const buyers = Array.isArray(input.buyers) ? input.buyers : []

  const affectedRows = replyRows.filter((row) => {
    const classification = String(row.classification || '')
    const email = normalizeEmail(row.from_email)
    if (hasIntegrityRepairMarker(row)) return Boolean(email)
    return (
      ['partner_reply', 'hot_seller_lead'].includes(classification) &&
      Boolean(email) &&
      !hasPriorOutboundCorrelation(row, outboundRows) &&
      isCampaignLike(row)
    )
  })
  const replyUpdates = affectedRows.filter(
    (row) => ['partner_reply', 'hot_seller_lead'].includes(String(row.classification || ''))
  )
  const falseMessageIds = new Set(affectedRows.map((row) => String(row.message_id || '')).filter(Boolean))
  const falseEmails = new Set(affectedRows.map((row) => normalizeEmail(row.from_email)).filter(Boolean))

  const footerRows = replyRows.filter((row) => {
    const email = normalizeEmail(row.from_email)
    return (
      Boolean(email) &&
      !hasPriorOutboundCorrelation(row, outboundRows) &&
      (hasFooterRepairMarker(row) || isFooterFalseOptOut(row))
    )
  })
  const footerUpdates = footerRows.filter((row) => !hasFooterRepairMarker(row))
  const footerFalseEmails = new Set(footerRows.map((row) => normalizeEmail(row.from_email)).filter(Boolean))
  const legitimateDirectOptOutEmails = new Set(
    replyRows
      .filter((row) => isDirectOptOut(row) && hasPriorOutboundCorrelation(row, outboundRows))
      .map((row) => normalizeEmail(row.from_email))
      .filter(Boolean)
  )
  const safeFooterFalseEmails = new Set(
    Array.from(footerFalseEmails).filter((email) => !legitimateDirectOptOutEmails.has(email))
  )

  const taskIds = tasks
    .filter(
      (task) =>
        REPLY_TASK_TYPES.has(String(task.task_type || '')) &&
        ['open', 'in_progress', 'waiting'].includes(String(task.status || '')) &&
        falseMessageIds.has(String(messageIdFromTask(task) || ''))
    )
    .map((task) => String(task.id))

  const suppressionIds = suppressions
    .filter(
      (suppression) =>
        suppression.status === 'active' &&
        suppression.reason === 'Explicit email opt-out received in Outlook.' &&
        safeFooterFalseEmails.has(normalizeEmail(suppression.email))
    )
    .map((suppression) => String(suppression.id))

  const buyerIds = buyers
    .filter((buyer) => {
      const email = normalizeEmail(buyer.contact_email)
      return (
        buyer.source === 'outlook_partner_reply' &&
        falseEmails.has(email) &&
        !replyRows.some(
          (row) => normalizeEmail(row.from_email) === email && hasPriorOutboundCorrelation(row, outboundRows)
        ) &&
        (buyer.relationship_stage !== 'not_a_fit' || buyer.outreach_status !== 'do_not_contact')
      )
    })
    .map((buyer) => String(buyer.id))

  return {
    replyUpdates: replyUpdates.map((row) => ({
      id: String(row.id),
      messageId: String(row.message_id || ''),
      originalClassification: String(row.classification),
      metadata: row.metadata_json || {},
    })),
    footerUpdates: footerUpdates.map((row) => ({
      id: String(row.id),
      metadata: row.metadata_json || {},
    })),
    taskIds,
    suppressionIds,
    buyerIds,
    // Derived from durable reply evidence rather than active suppression rows.
    // This keeps exact lead-flag repair retryable after a partial prior release.
    suppressionEmails: Array.from(safeFooterFalseEmails),
    counts: {
      repliesToReclassify: replyUpdates.length,
      tasksToDismiss: taskIds.length,
      suppressionsToRelease: suppressionIds.length,
      buyersToQuarantine: buyerIds.length,
    },
  }
}
