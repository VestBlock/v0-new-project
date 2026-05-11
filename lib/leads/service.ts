import { enrichLeadEmailFromWebsite } from '@/lib/leads/email-enrichment'
import { sendLeadOutreachSentAlertEmail } from '@/lib/email/sendEmail'
import { getLeadEmailAutopilotDecision, isLegacyGooglePlacesPhaseOutEnabled } from '@/lib/leads/autopilot'
import { validateOutreachMessageQuality } from '@/lib/leads/revenueCampaigns'
import { logEvent } from '@/lib/system/logEvent'
import { runNewLeadAutomation } from '@/lib/leads/leadAutomation'
import { isSourceInFamily } from '@/lib/leads/source-keys'
import { generateLeadOutreach } from '@/lib/leads/outreach'
import { sendLeadOutreachEmail } from '@/lib/leads/outbound'
import { isUsableContactEmail, normalizeEmailAddress } from '@/lib/outreach/email-quality'
import { addLeadNote, finishScrapeRun, insertOutreachSendEvent, listSuppressions, saveLeadScore, saveOutreachMessages, startScrapeRun, updateOutreachMessage, upsertLead, updateLeadRecord } from '@/lib/leads/repository'
import { scoreLead } from '@/lib/leads/scoring'
import type { GeneratedOutreachBundle, LeadRecord, NormalizedLeadInput, OutreachMessageRecord } from '@/lib/leads/types'

type IngestLeadOptions = {
  scoreOnIngest?: boolean
  autoGenerateOutreach?: boolean
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

function shouldPhaseOutGooglePlacesSource(source: string | null | undefined) {
  return isSourceInFamily(source, 'google_places_businesses') && isLegacyGooglePlacesPhaseOutEnabled()
}

function shouldAutoGenerateOutreachForLead(sourceKey: string, lead: LeadRecord) {
  if (shouldPhaseOutGooglePlacesSource(sourceKey) || shouldPhaseOutGooglePlacesSource(lead.source)) return false
  if (!lead.email || !isUsableContactEmail(lead.email)) return false
  if (lead.outreach_status && !['not_started', 'failed'].includes(String(lead.outreach_status))) return false
  if (lead.status && ['contacted', 'closed', 'closed_won', 'closed_lost', 'disqualified', 'do_not_contact'].includes(String(lead.status))) return false
  return true
}

async function autoSendApprovedLeadEmail(lead: LeadRecord, message: OutreachMessageRecord) {
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
  })

  if (sendResult.ok) {
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
        delivery_status: 'sent',
        last_contacted_at: new Date().toISOString(),
        next_follow_up_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      insertOutreachSendEvent({
        leadId: lead.id,
        outreachMessageId: message.id,
        channel: 'email',
        provider: sendResult.provider,
        status: 'sent',
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
  if (isUsableContactEmail(input.email) || !input.website) {
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
  if (isUsableContactEmail(lead.email) || !lead.website) {
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

export async function generateAndStoreOutreachForLead(lead: LeadRecord) {
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

      if (decision.autoSendEnabled && !shouldPhaseOutGooglePlacesSource(lead.source)) {
        await autoSendApprovedLeadEmail(lead, {
          ...approvedMessage,
          subject: approvedMessage.subject || emailMessage.subject || null,
          body: approvedMessage.body || emailMessage.body,
        })
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
