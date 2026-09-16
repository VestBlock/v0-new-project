export type OutlookMessageHeader = {
  name?: string | null
  value?: string | null
}

export type OutlookInboundMessage = {
  id: string
  receivedDateTime?: string | null
  conversationId?: string | null
  internetMessageId?: string | null
  internetMessageHeaders?: OutlookMessageHeader[]
  subject?: string | null
  bodyPreview?: string | null
  from?: { emailAddress?: { address?: string | null; name?: string | null } | null } | null
}

export type MailboxClassification =
  | 'hot_seller_lead'
  | 'partner_reply'
  | 'spam_noise'
  | 'operational_alert'
  | 'low_priority'

export type OutboundCorrelation = {
  matched: boolean
  matchType?: 'correlation_id' | 'message_reference' | 'thread' | 'recipient'
  source?: OutlookOutboundEvidence['source']
  leadId?: string | null
  strategyKey?: string | null
  outboundMessageId?: string | null
  provider?: string | null
  providerMessageId?: string | null
  occurredAt?: string | null
  entityScope?: 'lead' | 'buyer' | 'lender' | 'investor' | 'buyer_packet' | null
  entityId?: string | null
  sourceMessageTable?: string | null
  sourceMessageId?: string | null
  sourceEventId?: string | null
  dispatchId?: string | null
  dispatchState?: string | null
  internetMessageId?: string | null
}

export type OutlookOutboundEvidence = {
  source: 'enrollment' | 'send_event' | 'source_message' | 'dispatch_ledger'
  leadId: string | null
  strategyKey: string | null
  recipient: string | null
  outboundMessageId: string | null
  provider?: string | null
  providerMessageId?: string | null
  occurredAt: string | null
  metadata: Record<string, unknown>
}

export type OutlookSenderAuthentication = {
  aligned: boolean
  method: 'dmarc' | 'dkim' | 'spf' | null
  status: 'aligned' | 'missing' | 'failed_or_unaligned'
  fromDomain: string | null
}

export const OUTLOOK_REPLY_WINDOW_DAYS = 120
export const OUTLOOK_RECIPIENT_FALLBACK_DAYS = 14

type RelationshipHints = {
  lead?: boolean
  buyer?: boolean
  lender?: boolean
  investor?: boolean
}

function cleanText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function headerValue(message: OutlookInboundMessage, name: string) {
  const target = name.toLowerCase()
  return cleanText(
    message.internetMessageHeaders?.find((header) => cleanText(header.name).toLowerCase() === target)?.value
  )
}

function headerValues(message: OutlookInboundMessage, names: string[]) {
  const targets = new Set(names.map((name) => name.toLowerCase()))
  return (message.internetMessageHeaders || [])
    .filter((header) => targets.has(cleanText(header.name).toLowerCase()))
    .map((header) => cleanText(header.value))
    .filter(Boolean)
}

function emailDomain(value: string | null | undefined) {
  const normalized = cleanText(value)
    .replace(/^mailto:/i, '')
    .replace(/^<|>$/g, '')
    .replace(/[;,].*$/, '')
    .toLowerCase()
  const domain = normalized.includes('@') ? normalized.slice(normalized.lastIndexOf('@') + 1) : normalized
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) && domain.includes('.')
    ? domain
    : null
}

function domainsAlign(fromDomain: string, authenticatedDomain: string) {
  return (
    fromDomain === authenticatedDomain ||
    fromDomain.endsWith(`.${authenticatedDomain}`) ||
    authenticatedDomain.endsWith(`.${fromDomain}`)
  )
}

/**
 * Recipient-only correlation is convenient but the visible From header is not
 * proof of identity. Authentication-Results is retained as diagnostic evidence
 * only: Graph does not identify which duplicate header was stamped by the
 * receiver, so it cannot safely authorize a state change by itself. Exact
 * reply/thread evidence is evaluated separately.
 */
export function evaluateOutlookSenderAuthentication(
  message: OutlookInboundMessage,
  fromEmail: string | null | undefined
): OutlookSenderAuthentication {
  const fromDomain = emailDomain(fromEmail)
  // Only consume the receiver-stamped Authentication-Results field. An
  // ARC-Authentication-Results value is not authoritative unless the ARC
  // chain itself has been independently validated, which this boundary does
  // not attempt to do.
  const authenticationHeaders = headerValues(message, ['authentication-results'])
  if (!fromDomain || authenticationHeaders.length === 0) {
    return { aligned: false, method: null, status: 'missing', fromDomain }
  }

  const methodProperties = {
    dmarc: 'header\\.from',
    dkim: 'header\\.d',
    spf: 'smtp\\.mailfrom',
  } as const
  for (const method of ['dmarc', 'dkim', 'spf'] as const) {
    const property = methodProperties[method]
    for (const value of authenticationHeaders) {
      const result = new RegExp(
        `(?:^|;)\\s*${method}\\s*=\\s*pass\\b([^;]*)`,
        'i'
      ).exec(value)
      if (!result) continue
      const identity = new RegExp(
        `\\b${property}\\s*=\\s*<?([^\\s;>]+)>?`,
        'i'
      ).exec(result[1] || '')
      const authenticatedDomain = emailDomain(identity?.[1])
      if (authenticatedDomain && domainsAlign(fromDomain, authenticatedDomain)) {
        return { aligned: true, method, status: 'aligned', fromDomain }
      }
    }
  }

  return { aligned: false, method: null, status: 'failed_or_unaligned', fromDomain }
}

function metadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizeMessageIdentifier(value: string | null | undefined) {
  return cleanText(value).replace(/^mailto:/i, '').replace(/^<|>$/g, '').toLowerCase()
}

export function getOutlookReplyReferenceCandidates(message: OutlookInboundMessage) {
  return (message.internetMessageHeaders || [])
    .filter((header) => /^(in-reply-to|references)$/i.test(cleanText(header.name)))
    .flatMap((header) => {
      const value = cleanText(header.value)
      const bracketed = Array.from(value.matchAll(/<([^>]+)>/g), (match) => `<${match[1].trim()}>`)
      const tokens = value
        .split(/\s+/)
        .map((token) => token.replace(/^[,;]+|[,;]+$/g, '').trim())
        .filter((token) => token.includes('@'))
      return [value, ...bracketed, ...tokens].filter(Boolean)
    })
    .filter((value, index, values) => values.indexOf(value) === index)
}

function replyReferenceValues(message: OutlookInboundMessage) {
  return getOutlookReplyReferenceCandidates(message)
    .flatMap((value) => {
      const bracketed = Array.from(value.matchAll(/<([^>]+)>/g), (match) => normalizeMessageIdentifier(match[1]))
      return [normalizeMessageIdentifier(value), ...bracketed]
    })
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
}

function identifiersMatch(reference: string, candidate: string) {
  const normalizedReference = normalizeMessageIdentifier(reference)
  const normalizedCandidate = normalizeMessageIdentifier(candidate)
  if (!normalizedReference || !normalizedCandidate) return false
  if (normalizedReference === normalizedCandidate) return true

  // Providers commonly return the local part while RFC reply headers contain
  // `<provider-id@provider.example>`. Match that exact local part only; never
  // use a substring match that could validate unrelated messages.
  const referenceLocalPart = normalizedReference.includes('@')
    ? normalizedReference.slice(0, normalizedReference.indexOf('@'))
    : normalizedReference
  const candidateLocalPart = normalizedCandidate.includes('@')
    ? normalizedCandidate.slice(0, normalizedCandidate.indexOf('@'))
    : normalizedCandidate
  return (
    referenceLocalPart.length >= 8 &&
    candidateLocalPart.length >= 8 &&
    referenceLocalPart === candidateLocalPart
  )
}

function parseTimestamp(value: string | null | undefined) {
  const timestamp = Date.parse(cleanText(value))
  return Number.isFinite(timestamp) ? timestamp : null
}

function evidenceTimestamp(item: OutlookOutboundEvidence) {
  return (
    item.occurredAt ||
    metadataString(item.metadata, [
      'providerAcceptedAt',
      'provider_accepted_at',
      'sentAt',
      'sent_at',
      'createdAt',
      'created_at',
    ])
  )
}

function evidenceProvider(item: OutlookOutboundEvidence) {
  return (
    cleanText(item.provider) ||
    cleanText(metadataString(item.metadata, ['provider', 'sendProvider', 'send_provider']))
  ).toLowerCase() || null
}

function eligibleEvidence(
  message: OutlookInboundMessage,
  evidence: OutlookOutboundEvidence[],
  replyWindowDays: number
) {
  const inboundAt = parseTimestamp(message.receivedDateTime)
  if (inboundAt === null) return []
  const lowerBound = inboundAt - Math.max(1, replyWindowDays) * 24 * 60 * 60 * 1000

  return evidence
    .map((item) => ({ item, occurredAt: evidenceTimestamp(item), timestamp: parseTimestamp(evidenceTimestamp(item)) }))
    .filter(
      (entry): entry is { item: OutlookOutboundEvidence; occurredAt: string; timestamp: number } =>
        entry.timestamp !== null && entry.timestamp <= inboundAt && entry.timestamp >= lowerBound
    )
    .sort((left, right) => right.timestamp - left.timestamp)
}

function correlationFromEvidence(
  item: OutlookOutboundEvidence,
  matchType: NonNullable<OutboundCorrelation['matchType']>,
  occurredAt: string
): OutboundCorrelation {
  return {
    matched: true,
    matchType,
    source: item.source,
    leadId: item.leadId,
    strategyKey: item.strategyKey,
    outboundMessageId: item.outboundMessageId,
    provider: evidenceProvider(item),
    providerMessageId:
      item.providerMessageId ||
      metadataString(item.metadata, ['providerMessageId', 'provider_message_id']),
    occurredAt,
    entityScope: metadataString(item.metadata, ['entityScope', 'entity_scope']) as OutboundCorrelation['entityScope'],
    entityId: metadataString(item.metadata, ['entityId', 'entity_id']),
    sourceMessageTable: metadataString(item.metadata, ['sourceMessageTable', 'source_message_table']),
    sourceMessageId:
      metadataString(item.metadata, ['sourceMessageId', 'source_message_id']) ||
      item.outboundMessageId,
    sourceEventId: metadataString(item.metadata, ['sourceEventId', 'source_event_id']),
    dispatchId: metadataString(item.metadata, ['dispatchId', 'dispatch_id']),
    dispatchState: metadataString(item.metadata, ['dispatchState', 'dispatch_state']),
    internetMessageId: metadataString(item.metadata, ['internetMessageId', 'internet_message_id']),
  }
}

export function correlateOutlookInbound(
  message: OutlookInboundMessage,
  fromEmail: string | null,
  evidence: OutlookOutboundEvidence[],
  options: { replyWindowDays?: number; recipientFallbackDays?: number } = {}
): OutboundCorrelation {
  const normalizedSender = cleanText(fromEmail).toLowerCase()
  const inboundTimestamp = parseTimestamp(message.receivedDateTime)
  const recipientLowerBound =
    inboundTimestamp === null
      ? null
      : inboundTimestamp -
        (options.recipientFallbackDays || OUTLOOK_RECIPIENT_FALLBACK_DAYS) * 24 * 60 * 60 * 1000
  const eligible = eligibleEvidence(
    message,
    evidence,
    options.replyWindowDays || OUTLOOK_REPLY_WINDOW_DAYS
  )
  const recipientMatches = eligible.filter(
    ({ item, timestamp }) =>
      Boolean(normalizedSender) &&
      recipientLowerBound !== null &&
      timestamp >= recipientLowerBound &&
      cleanText(item.recipient).toLowerCase() === normalizedSender
  )
  const references = replyReferenceValues(message)

  const inboundCorrelationId =
    headerValue(message, 'x-vestblock-correlation-id') || headerValue(message, 'x-correlation-id')
  if (inboundCorrelationId) {
    const normalizedCorrelationId = normalizeMessageIdentifier(inboundCorrelationId)
    const exactCorrelation = eligible.find(({ item }) => {
      const correlationId = metadataString(item.metadata, [
        'correlationId',
        'correlation_id',
        'outreachCorrelationId',
        'outreach_correlation_id',
      ])
      return Boolean(
        correlationId && normalizeMessageIdentifier(correlationId) === normalizedCorrelationId
      )
    })
    if (exactCorrelation) {
      return correlationFromEvidence(
        exactCorrelation.item,
        'correlation_id',
        exactCorrelation.occurredAt
      )
    }
  }

  for (const { item, occurredAt } of eligible) {
    const messageIdentifiers = [
      item.outboundMessageId,
      item.providerMessageId,
      metadataString(item.metadata, ['providerMessageId', 'provider_message_id']),
      metadataString(item.metadata, ['internetMessageId', 'internet_message_id']),
      metadataString(item.metadata, ['messageId', 'message_id']),
    ].filter((value): value is string => Boolean(value))
    const matchedIdentifier = messageIdentifiers.find((identifier) =>
      references.some((reference) => identifiersMatch(reference, identifier))
    )
    if (matchedIdentifier) {
      return correlationFromEvidence(item, 'message_reference', occurredAt)
    }
  }

  if (message.conversationId) {
    const threadMatch = eligible.find(({ item }) => {
      const threadId = metadataString(item.metadata, [
        'conversationId',
        'conversation_id',
        'threadId',
        'thread_id',
      ])
      return Boolean(threadId && threadId === message.conversationId)
    })
    if (threadMatch) {
      return correlationFromEvidence(threadMatch.item, 'thread', threadMatch.occurredAt)
    }
  }

  const recipientMatch = recipientMatches[0]
  if (recipientMatch) {
    return correlationFromEvidence(recipientMatch.item, 'recipient', recipientMatch.occurredAt)
  }

  return { matched: false }
}

export function requireOutlookThroughputProjectionUpdated(result: unknown) {
  const outcome = result && typeof result === 'object'
    ? result as { updated?: unknown; reason?: unknown }
    : null
  if (outcome?.updated === true) return outcome

  const reason = typeof outcome?.reason === 'string' && outcome.reason.trim()
    ? outcome.reason.trim()
    : 'unknown_reason'
  throw new Error(`Mailbox throughput reply projection was not updated: ${reason}`)
}

export function selectCorrelatedLead<
  T extends { id: string; email?: string | null },
>(input: {
  leads: T[]
  fromEmail: string | null
  correlation: OutboundCorrelation
}): T | null {
  const normalizedSender = cleanText(input.fromEmail).toLowerCase()
  const candidates = input.leads.filter(
    (lead) => Boolean(normalizedSender) && cleanText(lead.email).toLowerCase() === normalizedSender
  )
  if (input.correlation.leadId) {
    return candidates.find((lead) => lead.id === input.correlation.leadId) || null
  }
  return candidates.length === 1 ? candidates[0] : null
}

export function shouldProcessMailboxSideEffects(input: {
  metadata: Record<string, unknown> | null | undefined
  actionableReply: boolean
  allowSuppression: boolean
  allowDeliveryFailure?: boolean
}) {
  if (!input.actionableReply && !input.allowSuppression && !input.allowDeliveryFailure) return false
  const marker = input.metadata?.mailboxSideEffects
  if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return true
  return (marker as Record<string, unknown>).status !== 'completed'
}

function isAutomaticReply(message: OutlookInboundMessage) {
  const subject = cleanText(message.subject).toLowerCase()
  const preview = cleanText(message.bodyPreview).toLowerCase()
  const autoSubmitted = headerValue(message, 'auto-submitted').toLowerCase()
  return (
    /\b(automatic reply|auto.?reply|out of office|currently out of (?:the )?office|away from (?:the )?office)\b/.test(subject) ||
    /\b(i am|i'm|we are|we're) currently out of (?:the )?office\b/.test(preview) ||
    /\bwill return on\b/.test(preview) ||
    Boolean(autoSubmitted && autoSubmitted !== 'no')
  )
}

function isKnownSpam(message: OutlookInboundMessage) {
  const subject = cleanText(message.subject).toLowerCase()
  const preview = cleanText(message.bodyPreview).toLowerCase()
  const sender = cleanText(message.from?.emailAddress?.address).toLowerCase()
  const combined = `${subject} ${preview}`
  return (
    /\b0rzp4az\b|blood__|community_customs|rod\.ordinary|minerals--|occasionally__|glad--invented/.test(combined) ||
    /pipelinecontentgrowthplus|\.info$/.test(sender) ||
    /salesforce conference|content for your blog|new social media manager|add you to my email list/.test(combined)
  )
}

export function isOutlookDeliveryFailureMessage(message: OutlookInboundMessage) {
  const subject = cleanText(message.subject).toLowerCase()
  const preview = cleanText(message.bodyPreview).toLowerCase()
  const sender = cleanText(message.from?.emailAddress?.address).toLowerCase()
  const contentType = headerValue(message, 'content-type').toLowerCase()
  const failedRecipients = headerValue(message, 'x-failed-recipients')
  const diagnosticCode = headerValue(message, 'diagnostic-code')
  const systemSender = /^(?:mailer-daemon|postmaster|microsoftexchange|mail-daemon|maildelivery|mail-delivery)(?:[+._-][^@]*)?@/i.test(sender)
  const deliveryStatusReport = /report-type\s*=\s*delivery-status/i.test(contentType)
  const strongSubject = /\b(?:undeliverable|delivery (?:status notification \(failure\)|failure|failed)|mail delivery failed|returned mail|failure notice|message (?:was )?not delivered)\b/i.test(subject)
  const diagnosticPreview = /\b(?:recipient address rejected|address not found|mailbox unavailable|permanent failure|delivery has failed|couldn(?:'|’)t be delivered|could not be delivered|550\s+5\.)\b/i.test(preview)
  return Boolean(
    strongSubject &&
    (systemSender || deliveryStatusReport || failedRecipients || diagnosticCode || diagnosticPreview)
  )
}

function isOperationalMessage(message: OutlookInboundMessage) {
  const combined = `${cleanText(message.subject)} ${cleanText(message.bodyPreview)}`.toLowerCase()
  return (
    isAutomaticReply(message) ||
    isOutlookDeliveryFailureMessage(message) ||
    /dealmachine|export complete|contacts export/.test(combined)
  )
}

function isBulkMail(message: OutlookInboundMessage) {
  const subject = cleanText(message.subject).toLowerCase()
  const preview = cleanText(message.bodyPreview).toLowerCase()
  const sender = cleanText(message.from?.emailAddress?.address).toLowerCase()
  const precedence = headerValue(message, 'precedence').toLowerCase()
  const hasListHeaders = Boolean(
    headerValue(message, 'list-id') || headerValue(message, 'list-unsubscribe') || headerValue(message, 'list-post')
  )

  return (
    hasListHeaders ||
    /^(bulk|list|junk)$/i.test(precedence) ||
    /^(?:no-?reply|newsletter|news|updates?|marketing|notifications?)@/.test(sender) ||
    /\b(view (?:this email )?in (?:your )?browser|manage (?:email )?preferences|you (?:are|were) receiving this email|weekly (?:news|newsletter|digest)|email newsletter|reply (?:with )?["'“”]?opt[ -]?out)\b/.test(
      `${subject} ${preview}`
    )
  )
}

function directOptOutIntent(message: OutlookInboundMessage, bulkMail: boolean) {
  const subject = cleanText(message.subject)
    .replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, '')
    .trim()
  const preview = cleanText(message.bodyPreview).slice(0, 280)
  if (bulkMail) return false
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

function partnerLanguage(message: OutlookInboundMessage) {
  const combined = `${cleanText(message.subject)} ${cleanText(message.bodyPreview)}`.toLowerCase()
  return /buy box|acquisition criteria|actively buying|proof of funds|lending box|builder|developer|partner submission/.test(
    combined
  )
}

function sellerLanguage(message: OutlookInboundMessage) {
  const combined = `${cleanText(message.subject)} ${cleanText(message.bodyPreview)}`.toLowerCase()
  return /my house|my property|sell my|selling the|mortgage|foreclosure|asking price|property address|interested in your offer/.test(
    combined
  )
}

function isPartnerStrategy(strategyKey: string | null | undefined) {
  return /(?:buyer|lender|investor|builder|partner|referral|wholesaler|contractor|property-manager|acquisition-manager|capital)/i.test(
    cleanText(strategyKey)
  )
}

export function evaluateOutlookInboundIntegrity(input: {
  message: OutlookInboundMessage
  correlation: OutboundCorrelation
  relationships: RelationshipHints
}) {
  const { message, correlation, relationships } = input
  const bulkMail = isBulkMail(message)
  const explicitOptOut = directOptOutIntent(message, bulkMail)
  const senderAuthentication = evaluateOutlookSenderAuthentication(
    message,
    message.from?.emailAddress?.address
  )
  const exactCorrelation = ['correlation_id', 'message_reference', 'thread'].includes(
    String(correlation.matchType || '')
  )
  // A standard Authentication-Results header can be injected upstream and
  // Graph does not expose a trusted-header provenance bit. Therefore a
  // recipient-only match always stays in manual review, even when its reported
  // authentication domains align. Only an exact VestBlock correlation,
  // provider-message reference, or known thread can mutate CRM/suppression.
  const stateChangeAuthorized = correlation.matched && exactCorrelation
  const manualReviewRequired =
    correlation.matched && !stateChangeAuthorized && correlation.matchType === 'recipient'
  let classification: MailboxClassification = 'low_priority'

  if (isKnownSpam(message)) classification = 'spam_noise'
  else if (isOperationalMessage(message)) classification = 'operational_alert'
  else if (bulkMail || explicitOptOut || !stateChangeAuthorized) classification = 'low_priority'
  else if (
    relationships.buyer ||
    relationships.lender ||
    relationships.investor ||
    isPartnerStrategy(correlation.strategyKey)
  ) {
    classification = 'partner_reply'
  } else if (relationships.lead || correlation.leadId) classification = 'hot_seller_lead'
  else if (partnerLanguage(message)) classification = 'partner_reply'
  else if (sellerLanguage(message)) classification = 'hot_seller_lead'

  const actionableReply =
    stateChangeAuthorized &&
    !bulkMail &&
    !explicitOptOut &&
    (classification === 'partner_reply' || classification === 'hot_seller_lead')
  const allowSuppression =
    stateChangeAuthorized && explicitOptOut && !bulkMail && classification === 'low_priority'
  const allowBuyerCreation =
    actionableReply &&
    classification === 'partner_reply' &&
    /buyer/i.test(cleanText(correlation.strategyKey)) &&
    !relationships.buyer &&
    !relationships.lender &&
    !relationships.investor

  return {
    classification,
    explicitOptOut,
    bulkMail,
    correlated: correlation.matched,
    exactCorrelation,
    stateChangeAuthorized,
    manualReviewRequired,
    senderAuthentication,
    actionableReply,
    allowRelationshipMutation: actionableReply,
    allowBuyerCreation,
    allowSuppression,
  }
}
