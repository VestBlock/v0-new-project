import { enrichLeadEmailFromWebsite } from '@/lib/leads/email-enrichment'
import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { recordStrategyDeliveryOutcome } from '@/lib/admin/strategyDelivery'
import { sendLeadOutreachSentAlertEmail } from '@/lib/email/sendEmail'
import { getLeadEmailAutopilotDecision } from '@/lib/leads/autopilot'
import { getLeadOutboundPauseReason, isCurrentVestblockOutboundLead } from '@/lib/leads/outboundEligibility'
import { validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { logEvent } from '@/lib/system/logEvent'
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation'
import { generateLeadOutreach } from '@/lib/leads/outreach'
import { getOutboundProviderReadiness, sendLeadOutreachEmail } from '@/lib/leads/outbound'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import { addLeadNote, finishScrapeRun, insertOutreachSendEvent, listSuppressions, saveLeadScore, saveOutreachMessages, startScrapeRun, updateOutreachMessage, upsertLead, updateLeadRecord } from '@/lib/leads/repository'
import { scoreLead } from '@/lib/leads/scoring'
import { safeUrl } from '@/lib/leads/utils'
import type { GeneratedOutreachBundle, LeadRecord, NormalizedLeadInput, OutreachMessageRecord } from '@/lib/leads/types'
import {
  authorizeOperatingStrategyDispatch,
  reserveOperatingStrategyDispatch,
  resolveOperatingStrategyLeadMembership,
} from '@/lib/strategy/runtime-governance'

type IngestLeadOptions = {
  scoreOnIngest?: boolean
  autoGenerateOutreach?: boolean
}

type GenerateOutreachOptions = {
  allowImmediateAutoSend?: boolean
}

const GOVERNED_SELLER_NAMESPACE = 'legacy_runtime'
const GOVERNED_SELLER_STRATEGY_KEY = 'seller-outreach'

function configuredEmailDispatchChannels(
  readiness: ReturnType<typeof getOutboundProviderReadiness>
) {
  if (readiness.resend) return ['resend_email']
  if (readiness.gmail) return ['gmail_email']
  return ['no_outreach']
}

function shouldTriggerLeadAutomation(category: string | null | undefined, score: number) {
  return score >= 85 || category === 'code_violation' || category === 'government_contracts'
}

function normalizeEmail(value: string | null | undefined) {
  return normalizeEmailAddress(value)
}

function isValidLeadEmail(value: string | null | undefined) {
  const email = normalizeEmail(value)
  if (!email) return null
  return isUsableContactEmail(email)
}

const WEBMAIL_EMAIL_DOMAINS = new Set(['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'aol.com'])

function extractEmailDomain(value: string | null | undefined) {
  const email = normalizeEmail(value)
  const parts = email?.split('@') || []
  return parts.length === 2 ? parts[1] : null
}

function extractWebsiteHost(value: string | null | undefined) {
  const normalized = safeUrl(value)
  if (!normalized) return null

  try {
    return new URL(normalized).host.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

function domainsLookAligned(emailDomain: string, websiteHost: string) {
  return emailDomain === websiteHost || emailDomain.endsWith(`.${websiteHost}`) || websiteHost.endsWith(`.${emailDomain}`)
}

function shouldVerifyExistingLeadEmail(input: {
  email?: string | null
  website?: string | null
  emailValid?: boolean | null
}) {
  if (!input.website || !isUsableContactEmail(input.email) || input.emailValid === false) return false

  const emailDomain = extractEmailDomain(input.email)
  const websiteHost = extractWebsiteHost(input.website)
  if (!emailDomain || !websiteHost) return false

  return WEBMAIL_EMAIL_DOMAINS.has(emailDomain) || !domainsLookAligned(emailDomain, websiteHost)
}

function estimateBounceRisk(lead: LeadRecord, emailValid: boolean | null) {
  let score = 10
  if (!lead.email) score += 40
  if (emailValid === false) score += 35
  if (!lead.website) score += 10
  if (!lead.phone) score += 5
  if (!lead.business_name && !lead.name) score += 5
  return Math.max(0, Math.min(100, score))
}

function estimateBounceRiskFromInput(
  lead: Pick<NormalizedLeadInput, 'email' | 'website' | 'phone' | 'businessName' | 'name'>,
  emailValid: boolean | null
) {
  let score = 10
  if (!lead.email) score += 40
  if (emailValid === false) score += 35
  if (!lead.website) score += 10
  if (!lead.phone) score += 5
  if (!lead.businessName && !lead.name) score += 5
  return Math.max(0, Math.min(100, score))
}

function shouldAutoGenerateOutreachForLead(sourceKey: string, lead: LeadRecord) {
  if (getLeadOutboundPauseReason({ ...lead, source: sourceKey }) || !isCurrentVestblockOutboundLead(lead)) return false
  if (!lead.email || !isUsableContactEmail(lead.email)) return false
  if (lead.outreach_status && !['not_started', 'failed'].includes(String(lead.outreach_status))) return false
  if (lead.status && ['contacted', 'closed', 'closed_won', 'closed_lost', 'disqualified', 'do_not_contact'].includes(String(lead.status))) return false
  return true
}

async function autoSendApprovedLeadEmail(lead: LeadRecord, message: OutreachMessageRecord) {
  const source = String(lead.source || '').trim().toLowerCase()
  const explicitlySellerMapped = lead.category === 'seller_lead' || lead.lead_type === 'sell_house'
  if (!explicitlySellerMapped || source.includes('dealmachine')) {
    return {
      sent: false as const,
      blocked: true as const,
      provider: 'none' as const,
      error: 'Immediate auto-send has no explicit governed seller mapping for this lead.',
    }
  }

  const suppressions = await listSuppressions()
  const dispatchDecision = getLeadEmailAutopilotDecision(lead, suppressions)
  if (!dispatchDecision.eligible || !dispatchDecision.autoSendEnabled) {
    return {
      sent: false as const,
      blocked: true as const,
      provider: 'none' as const,
      error: dispatchDecision.reason || 'Immediate auto-send guardrails did not authorize this lead.',
    }
  }

  const outboundReadiness = getOutboundProviderReadiness()
  const authorizedChannels = configuredEmailDispatchChannels(outboundReadiness)
  if (authorizedChannels.length !== 1 || authorizedChannels[0] === 'no_outreach') {
    throw new Error('Governed dispatch requires exactly one configured external email provider path.')
  }
  const selectedProvider = authorizedChannels[0] === 'resend_email' ? 'resend' as const : 'gmail' as const
  const bindings = await Promise.all(
    authorizedChannels.map((channel) =>
      authorizeOperatingStrategyDispatch({
        namespace: GOVERNED_SELLER_NAMESPACE,
        sourceIdentifier: GOVERNED_SELLER_STRATEGY_KEY,
        channel,
        requestedExternalSends: 1,
        requiredDispatchAuthority: 'vestblock_application',
      })
    )
  )
  const binding = bindings[0]
  if (
    bindings.some(
      (candidate) =>
        candidate.operatingStrategyVersionId !== binding.operatingStrategyVersionId ||
        candidate.contractFingerprint !== binding.contractFingerprint
    )
  ) {
    throw new Error('Configured provider paths did not resolve to one canonical operating strategy version.')
  }
  const strategyLeadMembershipId = await resolveOperatingStrategyLeadMembership({
    binding,
    leadId: lead.id,
  })
  const dispatchChannel = authorizedChannels[0]
  const dispatchReservation = await reserveOperatingStrategyDispatch({
    binding,
    channel: dispatchChannel,
    requestedCount: 1,
    idempotencyKey: `immediate-send:${binding.operatingStrategyVersionId}:${message.id}`,
  })
  const dispatchIntentAt = new Date().toISOString()
  const nextFollowUpAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const enrollmentBase = {
    strategyKey: GOVERNED_SELLER_STRATEGY_KEY,
    channel: 'email' as const,
    messageId: message.id,
    recipient: lead.email,
    leadId: lead.id,
    subjectNamespace: 'lead',
    subjectKey: lead.id,
    market: [lead.city, lead.state].filter(Boolean).join(', '),
    propertyAddress: lead.property_address,
    binding,
    governedStage: 'dispatch_intent' as const,
    strategyLeadMembershipId,
    dispatchReservationId: dispatchReservation.reservationId,
    dispatchChannel,
    dispatchIntentAt,
    provider: selectedProvider,
    outreachPurpose: 'seller_acquisition_immediate_first_touch',
    consentBasisSnapshot: {
      basis: 'operator_approved_business_outreach',
      dispatchAuthorized: true,
      evidenceKey: `approved-outreach-message:${message.id}`,
      provenance: {
        messageId: message.id,
        messageStatus: message.status,
        autopilotDecision: dispatchDecision.reason || 'eligible',
      },
      messageStatus: message.status,
      approvedAt: message.approved_at || null,
      source: lead.source || null,
      capturedAt: dispatchIntentAt,
    },
    suppressionSnapshot: {
      checkedAt: dispatchIntentAt,
      suppressionCleared: true,
      evidenceKey: `immediate-send-preflight:${lead.id}:${dispatchIntentAt}`,
      eligible: dispatchDecision.eligible,
      guardrailDecision: dispatchDecision.reason || null,
      activeSuppression: false,
    },
    messageVersionKey: `${message.id}:approved:${message.approved_at || message.updated_at}`,
  }
  const dispatchIntent = await recordOutboundEnrollment({
    ...enrollmentBase,
    status: 'queued',
    nextActionAt: nextFollowUpAt,
    metadata: { action: 'auto_queued_after_approval', authorizedChannels },
  })

  await updateOutreachMessage(message.id, {
    status: 'queued',
    send_provider: null,
    send_error: null,
  })
  await insertOutreachSendEvent({
    leadId: lead.id,
    outreachMessageId: message.id,
    channel: 'email',
    status: 'queued',
    recipient: lead.email,
    subject: message.subject,
    metadata: { action: 'auto_queued_after_approval' },
  })

  const sendResult = await sendLeadOutreachEmail({
    lead,
    message,
    provider: selectedProvider,
    disableFallback: true,
  })

  if (sendResult.ok) {
    await recordOutboundEnrollment({
      ...enrollmentBase,
      enrollmentId: dispatchIntent.id,
      status: 'accepted',
      provider: sendResult.provider,
      providerMessageId: sendResult.providerMessageId || null,
      nextActionAt: nextFollowUpAt,
      metadata: { action: 'auto_sent_after_approval', authorizedChannels },
    })
    const acceptedDeliveryOutcome = await recordStrategyDeliveryOutcome({
      leadId: lead.id,
      subjectNamespace: 'lead',
      subjectKey: lead.id,
      messageId: message.id,
      enrollmentId: dispatchIntent.id,
      operatingStrategyVersionId: binding.operatingStrategyVersionId,
      occurredAt: dispatchIntentAt,
      provider: sendResult.provider,
      providerMessageId: sendResult.providerMessageId || null,
      status: 'accepted',
    })
    if (!acceptedDeliveryOutcome.updated) {
      throw new Error(`Governed delivery attribution failed closed: ${acceptedDeliveryOutcome.reason}.`)
    }
    await Promise.all([
      updateOutreachMessage(message.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        send_provider: sendResult.provider,
        send_error: null,
      }),
      updateLeadRecord(lead.id, {
        status: 'contacted',
        outreach_status: 'sent',
        delivery_status: 'accepted',
        last_contacted_at: new Date().toISOString(),
        next_follow_up_at: nextFollowUpAt,
      }),
      insertOutreachSendEvent({
        leadId: lead.id,
        outreachMessageId: message.id,
        channel: 'email',
        provider: sendResult.provider,
        status: 'accepted',
        recipient: lead.email,
        subject: message.subject,
        metadata: { providerMessageId: sendResult.providerMessageId || null, action: 'auto_sent_after_approval' },
      }),
      logEvent({
        eventType: 'email_sent',
        entityType: 'lead',
        entityId: lead.id,
        metadata: { channel: 'email', provider: sendResult.provider, outreachMessageId: message.id, autoSent: true },
      }),
      sendLeadOutreachSentAlertEmail({
        leadId: lead.id,
        leadType: lead.lead_type,
        name: lead.name || lead.business_name || null,
        email: lead.email,
        provider: sendResult.provider,
        subject: message.subject,
        sourcePath: lead.source_url || lead.source || null,
        deliveryMode: 'auto',
      }),
    ])
    return { sent: true as const, provider: sendResult.provider }
  }

  await recordOutboundEnrollment({
    ...enrollmentBase,
    enrollmentId: dispatchIntent.id,
    status: 'failed',
    provider: sendResult.provider,
    suppressionReason: sendResult.error || 'send_failed',
    metadata: {
      action: 'auto_send_failed_after_approval',
      authorizedChannels,
      error: sendResult.error || 'send_failed',
    },
  })
  const failedDeliveryOutcome = await recordStrategyDeliveryOutcome({
    leadId: lead.id,
    subjectNamespace: 'lead',
    subjectKey: lead.id,
    messageId: message.id,
    enrollmentId: dispatchIntent.id,
    operatingStrategyVersionId: binding.operatingStrategyVersionId,
    occurredAt: dispatchIntentAt,
    provider: sendResult.provider,
    providerMessageId: sendResult.providerMessageId || null,
    status: 'failed',
  })
  if (!failedDeliveryOutcome.updated) {
    throw new Error(`Governed delivery attribution failed closed: ${failedDeliveryOutcome.reason}.`)
  }
  await updateOutreachMessage(message.id, {
    status: 'failed',
    send_provider: sendResult.provider,
    send_error: sendResult.error || 'Send failed.',
  })
  await updateLeadRecord(lead.id, {
    outreach_status: 'failed',
    delivery_status: /bounce/i.test(sendResult.error || '') ? 'bounced' : 'failed',
  })
  await insertOutreachSendEvent({
    leadId: lead.id,
    outreachMessageId: message.id,
    channel: 'email',
    provider: sendResult.provider,
    status: 'failed',
    recipient: lead.email,
    subject: message.subject,
    errorMessage: sendResult.error,
    metadata: {
      action: 'auto_send_failed_after_approval',
      reason: sendResult.error || 'send_failed',
    },
  })
  await logEvent({
    eventType: 'email_failed',
    entityType: 'lead',
    entityId: lead.id,
    metadata: {
      channel: 'email',
      provider: sendResult.provider,
      outreachMessageId: message.id,
      error: sendResult.error,
      autoSent: true,
    },
  })
  return { sent: false as const, provider: sendResult.provider, error: sendResult.error }
}

export async function enrichNormalizedLeadContact(input: NormalizedLeadInput) {
  const shouldVerifyExistingEmail = shouldVerifyExistingLeadEmail({
    email: input.email,
    website: input.website,
    emailValid: input.emailValid,
  })

  if ((isUsableContactEmail(input.email) && !shouldVerifyExistingEmail) || !input.website) {
    return {
      lead: input,
      updated: false,
      status: isUsableContactEmail(input.email) ? 'already_present' : 'no_website',
    } as const
  }

  const result = await enrichLeadEmailFromWebsite(input.website)
  const nextEmail = result.primaryEmail || input.email || null
  const nextEmailValid = nextEmail ? isUsableContactEmail(nextEmail) : input.emailValid ?? null
  const nextLead: NormalizedLeadInput = {
    ...input,
    email: nextEmail,
    emailValid: nextEmail ? nextEmailValid : input.emailValid ?? null,
    bounceRiskScore:
      nextEmail && nextEmailValid !== false
        ? estimateBounceRiskFromInput({ ...input, email: nextEmail }, nextEmailValid)
        : input.bounceRiskScore ?? null,
    contactInfo: {
      ...(input.contactInfo || {}),
      publicEmailCandidates: result.candidates,
      contactPageUrls: result.contactPageUrls,
      contactFormUrls: result.contactFormUrls,
      hasContactForm: result.hasContactForm,
      publicEmailEnrichment: {
        status: result.status,
        provider: result.provider,
        confidence: result.confidence,
        note: result.note,
        attemptedUrls: result.attemptedUrls,
        sourceUrls: result.sourceUrls,
        contactPageUrls: result.contactPageUrls,
        contactFormUrls: result.contactFormUrls,
        hasContactForm: result.hasContactForm,
        checkedAt: new Date().toISOString(),
      },
    },
    metadata: {
      ...(input.metadata || {}),
      emailEnrichment: {
        status: result.status,
        provider: result.provider,
        confidence: result.confidence,
        checkedAt: new Date().toISOString(),
        primaryEmail: result.primaryEmail,
        hasContactForm: result.hasContactForm,
      },
    },
  }

  return {
    lead: nextLead,
    updated: Boolean(result.primaryEmail),
    status: result.status,
    result,
  } as const
}

export async function enrichLeadContactEmail(lead: LeadRecord) {
  const shouldVerifyExistingEmail = shouldVerifyExistingLeadEmail({
    email: lead.email,
    website: lead.website,
    emailValid: lead.email_valid,
  })

  if ((isUsableContactEmail(lead.email) && !shouldVerifyExistingEmail) || !lead.website) {
    return {
      lead,
      updated: false,
      status: isUsableContactEmail(lead.email) ? 'already_present' : 'no_website',
    } as const
  }

  const previousCheckedAt =
    typeof lead.automation_flags_json?.emailEnrichment === 'object' &&
    lead.automation_flags_json.emailEnrichment &&
    typeof (lead.automation_flags_json.emailEnrichment as Record<string, unknown>).checkedAt === 'string'
      ? String((lead.automation_flags_json.emailEnrichment as Record<string, unknown>).checkedAt)
      : null

  if (previousCheckedAt) {
    const previousMs = Date.parse(previousCheckedAt)
    if (!Number.isNaN(previousMs) && Date.now() - previousMs < 14 * 24 * 60 * 60 * 1000) {
      return {
        lead,
        updated: false,
        status: 'recently_checked',
      } as const
    }
  }

  const result = await enrichLeadEmailFromWebsite(lead.website)
  const existingFlags = lead.automation_flags_json || {}
  const existingContact = lead.contact_info || {}
  const updatedLead = await updateLeadRecord(lead.id, {
    email: result.primaryEmail || lead.email,
    email_valid: result.primaryEmail ? true : lead.email_valid ?? null,
    bounce_risk_score: result.primaryEmail ? estimateBounceRisk({ ...lead, email: result.primaryEmail }, true) : lead.bounce_risk_score ?? null,
    contact_info: {
      ...existingContact,
      publicEmailCandidates: result.candidates,
      contactPageUrls: result.contactPageUrls,
      contactFormUrls: result.contactFormUrls,
      hasContactForm: result.hasContactForm,
      publicEmailEnrichment: {
        status: result.status,
        provider: result.provider,
        confidence: result.confidence,
        note: result.note,
        attemptedUrls: result.attemptedUrls,
        sourceUrls: result.sourceUrls,
        contactPageUrls: result.contactPageUrls,
        contactFormUrls: result.contactFormUrls,
        hasContactForm: result.hasContactForm,
        checkedAt: new Date().toISOString(),
      },
    },
    automation_flags_json: {
      ...existingFlags,
      emailEnrichment: {
        status: result.status,
        provider: result.provider,
        confidence: result.confidence,
        checkedAt: new Date().toISOString(),
        primaryEmail: result.primaryEmail,
        hasContactForm: result.hasContactForm,
      },
    },
  })

  return {
    lead: updatedLead,
    updated: Boolean(result.primaryEmail),
    status: result.status,
    result,
  } as const
}

async function maybeRunLeadAutomation(
  lead: LeadRecord,
  score: number,
  input: Pick<NormalizedLeadInput, 'category' | 'leadType' | 'name' | 'businessName' | 'email' | 'phone' | 'sourceUrl' | 'painSignal' | 'source'>
) {
  if (!shouldTriggerLeadAutomation(input.category, score)) return

  await runNewLeadAutomation({
    leadId: lead.id,
    leadType: input.leadType,
    name: input.name || input.businessName || null,
    email: input.email || null,
    phone: input.phone || null,
    sourcePath: input.sourceUrl || null,
    summary: input.painSignal || `Lead intelligence captured a ${input.category || input.leadType} lead.`,
    metadata: {
      source: input.source,
      category: input.category,
      bestOffer: lead.best_offer,
      leadScore: score,
    },
  })
}

export async function scoreAndPersistLead(
  lead: LeadRecord,
  context?: Pick<NormalizedLeadInput, 'category' | 'leadType' | 'name' | 'businessName' | 'email' | 'phone' | 'sourceUrl' | 'painSignal' | 'source'>
) {
  const score = await scoreLead(lead)
  await saveLeadScore(lead.id, score)

  const emailValid = typeof lead.email_valid === 'boolean' ? lead.email_valid : isValidLeadEmail(lead.email)
  const bounceRiskScore = estimateBounceRisk(lead, emailValid)

  await updateLeadRecord(lead.id, {
    email_valid: emailValid,
    bounce_risk_score: bounceRiskScore,
    niche: lead.niche || score.niche || null,
    market_segment: lead.market_segment || score.marketSegment || null,
    automation_flags_json: {
      ...(lead.automation_flags_json || {}),
      enrichedAt: new Date().toISOString(),
      enrichmentVersion: 'v2',
    },
  })

  if (context) {
    await maybeRunLeadAutomation(
      {
        ...lead,
        best_offer: score.bestOffer,
      },
      score.score,
      context
    )
  }

  return score
}

export async function ingestNormalizedLeads(
  sourceKey: string,
  runType: string,
  requestParams: Record<string, unknown>,
  inputs: NormalizedLeadInput[],
  options: IngestLeadOptions & {
    sourceDefinition?: {
      name: string
      category: string
      sourceType: string
      baseUrl?: string | null
      city?: string | null
      state?: string | null
      configJson?: Record<string, unknown>
      isActive?: boolean
    }
  } = {}
) {
  const scrapeRun = await startScrapeRun({
    sourceKey,
    runType,
    requestParams,
    sourceDefinition: options.sourceDefinition,
  })
  const scoreOnIngest = options.scoreOnIngest ?? true
  const autoGenerateOutreach = options.autoGenerateOutreach ?? true

  try {
    const createdLeads: LeadRecord[] = []
    for (const input of inputs) {
      const lead = await upsertLead(input)
      if (scoreOnIngest) {
        const score = await scoreAndPersistLead(lead, input)
        createdLeads.push({
          ...lead,
          lead_score: score.score,
          best_offer: score.bestOffer,
          urgency_level: score.urgencyLevel,
          contactability_level: score.contactabilityLevel,
          language_segment: score.languageSegment,
          outreach_angle: score.outreachAngle,
          estimated_value_label: score.estimatedValueLabel,
          niche: lead.niche || score.niche || null,
          market_segment: lead.market_segment || score.marketSegment || null,
          status: 'scored',
        } as LeadRecord)
      } else {
        createdLeads.push({
          ...lead,
          status: 'new',
        } as LeadRecord)
      }
    }

    if (scoreOnIngest && autoGenerateOutreach) {
      for (const lead of createdLeads) {
        if (!shouldAutoGenerateOutreachForLead(sourceKey, lead)) continue
        await generateAndStoreOutreachForLead(lead)
      }
    }

    await finishScrapeRun(scrapeRun.id, {
      status: 'completed',
      resultCount: createdLeads.length,
    })

    return createdLeads
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishScrapeRun(scrapeRun.id, {
      status: 'failed',
      errorMessage: message,
    })
    throw error
  }
}

export async function generateAndStoreOutreachForLead(
  lead: LeadRecord,
  options: GenerateOutreachOptions = {}
) {
  const allowImmediateAutoSend = options.allowImmediateAutoSend ?? true
  const bundle = await generateLeadOutreach(lead)
  const rows = bundleToRows(bundle)
  const saved = await saveOutreachMessages(lead.id, rows)
  const emailMessage = saved.find((row) => row.channel === 'email')
  let finalMessages = saved

  if (emailMessage) {
    const suppressions = await listSuppressions().catch(() => [])
    const decision = getLeadEmailAutopilotDecision(lead, suppressions)

    const qualityIssue = validateOutreachMessageQuality({ lead, message: emailMessage })

    if (decision.eligible && qualityIssue) {
      await insertOutreachSendEvent({
        leadId: lead.id,
        outreachMessageId: emailMessage.id,
        channel: 'email',
        status: 'skipped',
        recipient: lead.email,
        subject: emailMessage.subject,
        metadata: {
          action: 'auto_approval_skipped',
          guardrail: 'message_quality',
          reason: qualityIssue,
          skippedReason: qualityIssue,
          leadScore: lead.lead_score,
          bounceRiskScore: lead.bounce_risk_score,
        },
      })
    } else if (decision.eligible) {
      const approvedAt = new Date().toISOString()
      const approvedMessage = await updateOutreachMessage(emailMessage.id, {
        status: 'approved',
        approved_at: approvedAt,
        approved_by_user_id: null,
      })
      await updateLeadRecord(lead.id, { outreach_status: 'approved' })
      await insertOutreachSendEvent({
        leadId: lead.id,
        outreachMessageId: emailMessage.id,
        channel: 'email',
        status: 'approved',
        recipient: lead.email,
        subject: emailMessage.subject,
        metadata: {
          action: 'auto_approved',
          autoApproved: true,
          leadScore: lead.lead_score,
          bounceRiskScore: lead.bounce_risk_score,
        },
      })
      finalMessages = saved.map((row) => (row.id === approvedMessage.id ? approvedMessage : row))

      await logEvent({
        eventType: 'outreach_approved',
        entityType: 'lead',
        entityId: lead.id,
        metadata: {
          autoApproved: true,
          outreachMessageId: approvedMessage.id,
          leadScore: lead.lead_score,
          bounceRiskScore: lead.bounce_risk_score,
        },
      })

      if (allowImmediateAutoSend && decision.autoSendEnabled && isCurrentVestblockOutboundLead(lead)) {
        const immediateSend = await autoSendApprovedLeadEmail(lead, {
          ...approvedMessage,
          subject: approvedMessage.subject || emailMessage.subject || null,
          body: approvedMessage.body || emailMessage.body,
        })
        if (immediateSend.sent) {
          finalMessages = finalMessages.map((row) =>
            row.id === approvedMessage.id
              ? {
                  ...row,
                  ...approvedMessage,
                  status: 'sent',
                }
              : row
          )
        }
      }
    }
  }

  await logEvent({
    eventType: 'outreach_generated',
    entityType: 'lead',
    entityId: lead.id,
    metadata: {
      channelCount: finalMessages.length,
      generatedWith: bundle.generatedWith,
    },
  })

  return finalMessages
}

export async function addLeadNoteAndLog(leadId: string, authorUserId: string | null, note: string) {
  const saved = await addLeadNote(leadId, authorUserId, note, true)
  await logEvent({
    eventType: 'admin_action',
    actorUserId: authorUserId,
    entityType: 'lead',
    entityId: leadId,
    metadata: { action: 'lead_note_added' },
  })
  return saved
}

function bundleToRows(bundle: GeneratedOutreachBundle) {
  return [
    {
      channel: 'sms',
      subject: null,
      body: bundle.sms.body,
      cta: bundle.sms.cta,
      language: bundle.sms.language,
      complianceNote: bundle.sms.complianceNote,
      generatedWith: bundle.generatedWith,
    },
    {
      channel: 'email',
      subject: bundle.email.subject,
      body: bundle.email.body,
      cta: bundle.email.cta,
      language: bundle.email.language,
      complianceNote: bundle.email.complianceNote,
      generatedWith: bundle.generatedWith,
    },
    {
      channel: 'facebook_dm',
      subject: null,
      body: bundle.facebook_dm.body,
      cta: bundle.facebook_dm.cta,
      language: bundle.facebook_dm.language,
      complianceNote: bundle.facebook_dm.complianceNote,
      generatedWith: bundle.generatedWith,
    },
    {
      channel: 'instagram_dm',
      subject: null,
      body: bundle.instagram_dm.body,
      cta: bundle.instagram_dm.cta,
      language: bundle.instagram_dm.language,
      complianceNote: bundle.instagram_dm.complianceNote,
      generatedWith: bundle.generatedWith,
    },
    {
      channel: 'phone_script',
      subject: null,
      body: bundle.phone_script.body,
      cta: bundle.phone_script.cta,
      language: bundle.phone_script.language,
      complianceNote: bundle.phone_script.complianceNote,
      generatedWith: bundle.generatedWith,
    },
  ]
}
