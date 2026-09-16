import { randomUUID } from 'node:crypto'

import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { queueSeoForLenderRecord } from '@/lib/content/entitySeoExpansion'
import {
  enrichContactFromHunter,
  type HunterContactCandidate,
  type HunterContactLookupResult,
} from '@/lib/email/hunter'
import { companyWebsiteDomain } from '@/lib/email/companyDomain'
import { discoverLendersForMarket } from '@/lib/lenders/discovery'
import {
  reserveLenderHunterDailyLookup,
  type LenderHunterLookupReservation,
} from '@/lib/lenders/hunterBudget'
import { matchBorrowerToLenders } from '@/lib/lenders/matching'
import { generateLenderOutreach, LENDER_OUTREACH_TEMPLATE_VERSION } from '@/lib/lenders/outreach'
import { evaluateLenderAutoApproval } from '@/lib/lenders/automationCore'
import {
  addLenderNote,
  approveLenderFollowupMessageIfReviewable,
  claimLenderForHunterEnrichment,
  findLenderRecordById,
  finishLenderOutreachRun,
  insertLenderRelationshipEvent,
  getReviewableLenderOutreachMessageByChannel,
  listApprovedLenderEmailOutreach,
  listLendersForScoring,
  listLendersNeedingFollowup,
  listLendersNeedingOutreach,
  saveLenderOutreachMessages,
  saveLenderScore,
  startLenderOutreachRun,
  updateLenderPerformance,
  updateLenderRecord,
  updateLenderRecordIfVersion,
  upsertLender,
  upsertLenderMatch,
} from '@/lib/lenders/repository'
import { scoreLender } from '@/lib/lenders/scoring'
import { analyzeLenderWebsite } from '@/lib/lenders/site-analysis'
import type { BorrowerMatchInput, LenderRecord } from '@/lib/lenders/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'
import { buildDiscoveryCooldownMessage, findRecentDiscoveryRun } from '@/lib/partners/discoveryCooldown'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { hashHunterVerificationEmail } from '@/lib/outreach/hunterSendVerificationCore'
import { isPaidSourceBudgetSkipError } from '@/lib/leads/paidSourceBudget'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const LENDER_HUNTER_TERMINAL_COOLDOWN_DAYS = 30
const LENDER_HUNTER_ERROR_RETRY_HOURS = 6
const LENDER_HUNTER_STALE_CLAIM_HOURS = 2

function lenderHunterState(metadata?: Record<string, unknown> | null) {
  const raw = metadata?.hunterContactEnrichment
  if (!raw || typeof raw !== 'object') return { status: null, checkedAt: null }
  const state = raw as Record<string, unknown>
  const checkedAt = typeof state.checkedAt === 'string' && Number.isFinite(Date.parse(state.checkedAt))
    ? state.checkedAt
    : null
  return { status: typeof state.status === 'string' ? state.status : null, checkedAt }
}

export function isLenderHunterEnrichmentEligible(
  lender: Pick<LenderRecord, 'contact_email' | 'website' | 'metadata_json'>,
  now = new Date()
) {
  if (isUsableContactEmail(lender.contact_email) || !companyWebsiteDomain(lender.website)) return false
  const { status, checkedAt } = lenderHunterState(lender.metadata_json)
  if (!checkedAt) return true
  const ageMs = now.getTime() - Date.parse(checkedAt)
  if (ageMs < 0) return false
  if (status === 'checking') return ageMs >= LENDER_HUNTER_STALE_CLAIM_HOURS * 3600000
  if (status === 'error' || status === 'skipped' || status === 'skipped_budget') {
    return ageMs >= LENDER_HUNTER_ERROR_RETRY_HOURS * 3600000
  }
  return ageMs >= LENDER_HUNTER_TERMINAL_COOLDOWN_DAYS * 86400000
}

export function selectVerifiedLenderHunterCandidate(candidates: HunterContactCandidate[]) {
  return candidates
    .filter(
      (candidate) =>
        candidate.verificationStatus === 'valid' &&
        Number(candidate.confidence) >= 90 &&
        isUsableContactEmail(candidate.email)
    )
    .sort((left, right) => right.score - left.score || right.confidence - left.confidence)[0] || null
}

function safeHunterMetadataText(value?: string | null, maximumLength = 160) {
  return value?.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximumLength) || null
}

export function buildSanitizedLenderHunterMetadata(input: {
  status: string
  domain?: string | null
  organization?: string | null
  checkedAt: string
  claimId?: string | null
  reservationId?: string | null
  budgetReason?: string | null
  candidate?: HunterContactCandidate | null
  topCandidateConfidence?: number | null
  topCandidateVerificationStatus?: string | null
}) {
  const accepted = Boolean(
    input.candidate &&
      input.candidate.verificationStatus === 'valid' &&
      Number(input.candidate.confidence) >= 90 &&
      isUsableContactEmail(input.candidate.email)
  )
  const checkedTime = Date.parse(input.checkedAt)
  const safeStatuses = new Set(['found', 'not_found', 'skipped', 'skipped_budget', 'error', 'checking'])
  return {
    provider: 'hunter',
    status: safeStatuses.has(input.status) ? input.status : 'error',
    domain: companyWebsiteDomain(input.domain) || safeHunterMetadataText(input.domain, 120),
    organization: safeHunterMetadataText(input.organization),
    checkedAt: Number.isFinite(checkedTime) ? new Date(checkedTime).toISOString() : new Date().toISOString(),
    claimId: input.claimId || null,
    reservationId: input.reservationId || null,
    budgetReason: safeHunterMetadataText(input.budgetReason, 120),
    accepted,
    acceptedRecipientHash: accepted
      ? hashHunterVerificationEmail(input.candidate?.email || '')
      : null,
    acceptedConfidence: accepted ? Number(input.candidate?.confidence) : null,
    acceptedVerificationStatus: accepted ? 'valid' : null,
    topCandidateConfidence:
      typeof input.topCandidateConfidence === 'number' && Number.isFinite(input.topCandidateConfidence)
        ? input.topCandidateConfidence
        : null,
    topCandidateVerificationStatus: safeHunterMetadataText(input.topCandidateVerificationStatus, 40),
  }
}

export type LenderScoringOutcome = {
  scored: LenderRecord | null
  failed: boolean
  hunterAttempted: boolean
  result: {
    lenderId: string
    name: string
    confidenceScore: number | null
    status: string
    reason?: string
  }
}

export function summarizeLenderScoringOutcomes(outcomes: LenderScoringOutcome[]) {
  const errorCount = outcomes.filter((outcome) => outcome.failed).length
  return {
    ok: errorCount === 0,
    partial: errorCount > 0 && errorCount < outcomes.length,
    errorCount,
    scoredCount: outcomes.filter((outcome) => Boolean(outcome.scored)).length,
    hunterAttempted: outcomes.filter((outcome) => outcome.hunterAttempted).length,
  }
}

export async function discoverAndIngestLendersForMarket(input: {
  city: string
  state: string
  metroArea?: string | null
  niches: string[]
  limitPerNiche: number
}) {
  const run = await startLenderOutreachRun({
    runType: 'discovery',
    sourceKey: 'google_places_lenders',
    requestParams: input,
  })

  try {
    const cooldownHours = envInt('LENDER_DISCOVERY_COOLDOWN_HOURS', 72)
    const recentRun = await findRecentDiscoveryRun({
      table: 'lender_outreach_runs',
      completedAtColumn: 'completed_at',
      sourceKey: 'google_places_lenders',
      city: input.city,
      state: input.state,
      cooldownHours,
    })

    if (recentRun) {
      await finishLenderOutreachRun(run.id, {
        status: 'partial',
        resultCount: 0,
        errorMessage: buildDiscoveryCooldownMessage({
          label: 'lender',
          city: input.city,
          state: input.state,
          cooldownHours,
          completedAt: recentRun.completedAt,
        }),
      })
      return []
    }

    const raw = await discoverLendersForMarket({
      city: input.city,
      state: input.state,
      metroArea: input.metroArea,
      niches: input.niches,
      limitPerNiche: input.limitPerNiche,
      provider: 'google',
    })

    const saved: LenderRecord[] = []
    for (const lenderInput of raw) {
      const lender = await upsertLender(lenderInput)
      saved.push(lender)
      await insertLenderRelationshipEvent({
        lenderId: lender.id,
        eventType: 'discovered',
        metadata: {
          source: lender.source,
          market: `${input.city}, ${input.state}`,
          niche: lenderInput.metadata?.niche || null,
        },
      })
      await queueSeoForLenderRecord({
        id: lender.id,
        name: lender.name,
        category: lender.category,
        headquarters_city: lender.headquarters_city,
        headquarters_state: lender.headquarters_state,
        relationship_stage: lender.relationship_stage,
      }).catch((error) => {
        console.warn('[entity-seo] lender queue skipped:', error)
      })
    }

    await finishLenderOutreachRun(run.id, {
      status: 'completed',
      resultCount: saved.length,
    })

    return saved
  } catch (error) {
    await finishLenderOutreachRun(run.id, {
      status: isPaidSourceBudgetSkipError(error) ? 'partial' : 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function enrichAndScoreLender(
  lender: LenderRecord,
  options: {
    allowPaidHunter?: boolean
    onHunterReservation?: (reservation: LenderHunterLookupReservation) => void
  } = {}
): Promise<LenderScoringOutcome> {
  const siteAnalysis = await analyzeLenderWebsite(lender.website)
  const existingContactEmail = isUsableContactEmail(lender.contact_email) ? lender.contact_email : null
  const publicContactEmail = isUsableContactEmail(siteAnalysis.contactEmail) ? siteAnalysis.contactEmail : null
  const paidGateOpen =
    options.allowPaidHunter === true &&
    process.env.LENDER_ENRICHMENT_PREFER_FREE?.trim().toLowerCase() === 'false' &&
    Boolean(process.env.HUNTER_API_KEY?.trim())
  const hunterDailyLimit = Math.min(25, envInt('LENDERS_DAILY_HUNTER_LOOKUP_LIMIT', 10))
  let writeBase = lender
  let hunterClaimId: string | null = null
  let hunterReservation: LenderHunterLookupReservation | null = null
  let hunterResult: HunterContactLookupResult | null = null
  let reservationFailed = false
  const currentHunterState = lenderHunterState(lender.metadata_json)
  const currentHunterClaimAgeMs = currentHunterState.checkedAt
    ? Date.now() - Date.parse(currentHunterState.checkedAt)
    : Number.POSITIVE_INFINITY
  const freshHunterClaim =
    currentHunterState.status === 'checking' &&
    currentHunterClaimAgeMs < LENDER_HUNTER_STALE_CLAIM_HOURS * 3600000

  if (!existingContactEmail && freshHunterClaim) {
    return {
      scored: null,
      failed: false,
      hunterAttempted: false,
      result: {
        lenderId: lender.id,
        name: lender.name,
        confidenceScore: lender.confidence_score,
        status: 'concurrent_claim_blocked',
      },
    }
  }

  if (
    paidGateOpen &&
    !existingContactEmail &&
    !publicContactEmail &&
    isLenderHunterEnrichmentEligible(lender)
  ) {
    const claimId = randomUUID()
    const claimed = await claimLenderForHunterEnrichment({ lender, claimId })
    if (claimed) {
      writeBase = claimed
      hunterClaimId = claimId
      try {
        hunterReservation = await reserveLenderHunterDailyLookup({
          lenderId: claimed.id,
          claimId,
          dailyLimit: hunterDailyLimit,
        })
      } catch {
        hunterReservation = {
          allowed: false,
          reason: 'lender_hunter_budget_reservation_failed',
          attemptCount: 0,
          remaining: 0,
        }
      }
      options.onHunterReservation?.(hunterReservation)
      reservationFailed = !hunterReservation.allowed &&
        hunterReservation.reason !== 'lender_hunter_daily_budget_exhausted'

      if (hunterReservation.allowed) {
        hunterResult = await enrichContactFromHunter({
          website: claimed.website,
          contactName: claimed.contact_name || null,
          budgetReservationId: hunterReservation.reservationId!,
        })
      }
    } else {
      return {
        scored: null,
        failed: false,
        hunterAttempted: false,
        result: {
          lenderId: lender.id,
          name: lender.name,
          confidenceScore: lender.confidence_score,
          status: 'concurrent_claim_blocked',
        },
      }
    }
  }

  const verifiedHunterContact = selectVerifiedLenderHunterCandidate(hunterResult?.candidates || [])
  const checkedAt = new Date().toISOString()
  const hunterMetadata = hunterResult
    ? buildSanitizedLenderHunterMetadata({
        status: hunterResult.status,
        domain: hunterResult.domain,
        organization: hunterResult.organization,
        checkedAt,
        claimId: hunterClaimId,
        reservationId: hunterReservation?.reservationId || null,
        candidate: verifiedHunterContact,
        topCandidateConfidence: hunterResult.primaryCandidate?.confidence ?? null,
        topCandidateVerificationStatus: hunterResult.primaryCandidate?.verificationStatus ?? null,
      })
    : hunterClaimId
      ? buildSanitizedLenderHunterMetadata({
          status: hunterReservation?.reason === 'lender_hunter_daily_budget_exhausted'
            ? 'skipped_budget'
            : 'error',
          checkedAt,
          claimId: hunterClaimId,
          reservationId: hunterReservation?.reservationId || null,
          budgetReason: hunterReservation?.reason || 'lender_hunter_lookup_not_reserved',
          candidate: null,
        })
      : (writeBase.metadata_json?.hunterContactEnrichment as Record<string, unknown> | undefined)
  const effectiveContactEmail = isUsableContactEmail(writeBase.contact_email)
    ? writeBase.contact_email
    : publicContactEmail || verifiedHunterContact?.email || null
  const updatedByVersion = await updateLenderRecordIfVersion({
    lenderId: writeBase.id,
    expectedUpdatedAt: writeBase.updated_at,
    expectedContactEmail: writeBase.contact_email,
    hunterClaimId,
    updates: {
      contact_email: effectiveContactEmail,
      contact_phone: writeBase.contact_phone || siteAnalysis.contactPhone || null,
      contact_name: writeBase.contact_name || verifiedHunterContact?.fullName || null,
      startup_allowed: writeBase.startup_allowed || siteAnalysis.startupAllowed,
      investor_allowed: writeBase.investor_allowed || siteAnalysis.investorAllowed,
      owner_occupied_allowed: writeBase.owner_occupied_allowed || siteAnalysis.ownerOccupiedAllowed,
      bilingual_support: writeBase.bilingual_support || siteAnalysis.bilingualSupport,
      spanish_support: writeBase.spanish_support || siteAnalysis.spanishSupport,
      low_doc: writeBase.low_doc || siteAnalysis.lowDoc,
      cash_out_allowed: writeBase.cash_out_allowed || siteAnalysis.cashOutAllowed,
      first_time_investor_allowed: writeBase.first_time_investor_allowed || siteAnalysis.firstTimeInvestorAllowed,
      loan_amount_min: writeBase.loan_amount_min ?? siteAnalysis.loanAmountMin ?? null,
      loan_amount_max: writeBase.loan_amount_max ?? siteAnalysis.loanAmountMax ?? null,
      fit_summary: writeBase.fit_summary || siteAnalysis.summary,
      metadata_json: {
        ...(writeBase.metadata_json || {}),
        lenderSiteAnalysis: siteAnalysis,
        hunterContactEnrichment: hunterMetadata,
      },
    },
  })
  const persistenceConflict = !updatedByVersion
  const updated = updatedByVersion || (await findLenderRecordById(writeBase.id))
  if (!updated) throw new Error(`Lender ${writeBase.id} no longer exists.`)

  const score = scoreLender(updated)
  const scored = await saveLenderScore(updated.id, score, updated.metadata_json || {})
  await logEvent({
    eventType: 'lender_scored',
    entityType: 'lender',
    entityId: updated.id,
    metadata: { confidenceScore: score.confidenceScore, category: updated.category },
  })

  const hunterAttempted = Boolean(hunterReservation?.allowed)
  const hunterLookupFailed = hunterResult?.status === 'error' || hunterResult?.status === 'skipped'
  const hunterPersistenceFailed = hunterAttempted && persistenceConflict
  const failed = reservationFailed || hunterLookupFailed || hunterPersistenceFailed
  const status = failed
    ? 'error'
    : verifiedHunterContact &&
        scored.contact_email?.toLowerCase() === verifiedHunterContact.email.toLowerCase()
      ? 'enriched'
      : hunterResult?.status === 'found'
        ? 'candidate_rejected'
        : hunterResult?.status ||
          (hunterReservation?.reason === 'lender_hunter_daily_budget_exhausted'
            ? 'skipped_budget'
            : 'scored_free')
  const reason = reservationFailed
    ? hunterReservation?.reason || 'lender_hunter_budget_reservation_failed'
    : hunterLookupFailed
      ? 'hunter_lookup_failed'
      : hunterPersistenceFailed
        ? 'record_persistence_conflict'
        : undefined

  return {
    scored,
    failed,
    hunterAttempted,
    result: {
      lenderId: scored.id,
      name: scored.name,
      confidenceScore: scored.confidence_score,
      status,
      ...(reason ? { reason } : {}),
    },
  }
}

export async function generateAndStoreLenderOutreach(lender: LenderRecord) {
  const bundle = generateLenderOutreach(lender)
  const saved = await saveLenderOutreachMessages(lender.id, [
    {
      channel: 'email_intro',
      subject: bundle.emailIntro.subject,
      body: bundle.emailIntro.body,
      cta: bundle.emailIntro.cta,
      partnershipAngle: bundle.emailIntro.partnershipAngle,
      borrowerReferralAngle: bundle.emailIntro.borrowerReferralAngle,
      complianceNote: bundle.emailIntro.complianceNote,
      language: 'en',
      generatedWith: bundle.generatedWith,
      metadata: {
        templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
        qualificationQuestions: bundle.emailIntro.qualificationQuestions,
        economicsPrompt: bundle.emailIntro.economicsPrompt,
      },
    },
    {
      channel: 'email_followup',
      subject: bundle.emailFollowup.subject,
      body: bundle.emailFollowup.body,
      cta: bundle.emailFollowup.cta,
      partnershipAngle: bundle.emailFollowup.partnershipAngle,
      borrowerReferralAngle: bundle.emailFollowup.borrowerReferralAngle,
      complianceNote: bundle.emailFollowup.complianceNote,
      language: 'en',
      generatedWith: bundle.generatedWith,
      metadata: {
        templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
        qualificationQuestions: bundle.emailFollowup.qualificationQuestions,
        economicsPrompt: bundle.emailFollowup.economicsPrompt,
      },
    },
    {
      channel: 'linkedin_dm',
      body: bundle.linkedInDm.body,
      cta: bundle.linkedInDm.cta,
      partnershipAngle: bundle.linkedInDm.partnershipAngle,
      borrowerReferralAngle: bundle.linkedInDm.borrowerReferralAngle,
      complianceNote: bundle.linkedInDm.complianceNote,
      language: 'en',
      generatedWith: bundle.generatedWith,
      metadata: {
        templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
        qualificationQuestions: bundle.linkedInDm.qualificationQuestions,
        economicsPrompt: bundle.linkedInDm.economicsPrompt,
      },
    },
    {
      channel: 'phone_script',
      body: bundle.phoneScript.body,
      cta: bundle.phoneScript.cta,
      partnershipAngle: bundle.phoneScript.partnershipAngle,
      borrowerReferralAngle: bundle.phoneScript.borrowerReferralAngle,
      complianceNote: bundle.phoneScript.complianceNote,
      language: 'en',
      generatedWith: bundle.generatedWith,
      metadata: {
        templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
        qualificationQuestions: bundle.phoneScript.qualificationQuestions,
        economicsPrompt: bundle.phoneScript.economicsPrompt,
      },
    },
    {
      channel: 'spanish_email',
      subject: bundle.spanishEmail.subject,
      body: bundle.spanishEmail.body,
      cta: bundle.spanishEmail.cta,
      partnershipAngle: bundle.spanishEmail.partnershipAngle,
      borrowerReferralAngle: bundle.spanishEmail.borrowerReferralAngle,
      complianceNote: bundle.spanishEmail.complianceNote,
      language: 'es',
      generatedWith: bundle.generatedWith,
      metadata: {
        templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
        qualificationQuestions: bundle.spanishEmail.qualificationQuestions,
        economicsPrompt: bundle.spanishEmail.economicsPrompt,
      },
    },
  ])

  await updateLenderRecord(lender.id, {
    last_outreach_generated_at: new Date().toISOString(),
    outreach_status: 'needs_review',
    relationship_stage:
      lender.relationship_stage === 'discovered' ? 'outreach_ready' : lender.relationship_stage,
  })

  await logEvent({
    eventType: 'lender_outreach_generated',
    entityType: 'lender',
    entityId: lender.id,
    metadata: { messageCount: saved.length },
  })
  return saved
}

export async function persistBorrowerLenderMatches(input: BorrowerMatchInput) {
  const admin = createAdminClient()
  const { data: lenders, error } = await admin
    .from('lenders')
    .select('*')
    .in('relationship_stage', ['discovered', 'researched', 'outreach_ready', 'contacted', 'responded', 'reviewing', 'active_partner'])
    .order('confidence_score', { ascending: false })
    .limit(250)

  if (error) throw error

  const ranked = matchBorrowerToLenders(input, (lenders || []) as LenderRecord[])
  const rows = []
  for (const item of ranked) {
    const saved = await upsertLenderMatch({
      lenderId: item.lender.id,
      borrower: input,
      confidenceScore: item.confidenceScore,
      fitSummary: item.fitSummary,
      fitExplanation: item.fitExplanation,
      nextDocsNeeded: item.nextDocsNeeded,
      fallbackOptions: item.fallbackOptions,
      metadata: {
        lenderCategory: item.lender.category,
        lenderType: item.lender.lender_type,
      },
    })
    rows.push(saved)
  }

  await logEvent({
    eventType: 'lender_match_generated',
    entityType: 'lender_match',
    metadata: {
      userId: input.userId || null,
      leadId: input.leadId || null,
      count: rows.length,
      serviceType: input.serviceType || null,
    },
  })

  return rows
}

export async function addLenderNoteAndLog(lenderId: string, authorUserId: string | null, note: string) {
  const saved = await addLenderNote(lenderId, authorUserId, note, true)
  await logEvent({
    eventType: 'admin_action',
    actorUserId: authorUserId,
    entityType: 'lender',
    entityId: lenderId,
    metadata: { action: 'lender_note_added' },
  })
  return saved
}

export async function runDailyLenderScoring(limit = 100) {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100
  const effectiveLimit = Math.min(50, Math.max(1, normalizedLimit))
  const paidHunterEnabled =
    process.env.LENDER_ENRICHMENT_PREFER_FREE?.trim().toLowerCase() === 'false' &&
    Boolean(process.env.HUNTER_API_KEY?.trim())
  const concurrency = Math.min(5, envInt('LENDERS_HUNTER_CONCURRENCY', 4))
  const hunterLookupLimit = Math.min(25, envInt('LENDERS_DAILY_HUNTER_LOOKUP_LIMIT', 10))
  const run = await startLenderOutreachRun({
    runType: 'scoring',
    sourceKey: 'lender_profiles_and_hunter',
    requestParams: {
      requestedLimit: limit,
      effectiveLimit,
      concurrency,
      paidHunterEnabled,
      hunterLookupLimit,
      terminalCooldownDays: LENDER_HUNTER_TERMINAL_COOLDOWN_DAYS,
      providerErrorRetryHours: LENDER_HUNTER_ERROR_RETRY_HOURS,
    },
  })

  try {
    const lenders = await listLendersForScoring(effectiveLimit)
    const outcomes: LenderScoringOutcome[] = []
    for (let offset = 0; offset < lenders.length; offset += concurrency) {
      const batch = lenders.slice(offset, offset + concurrency)
      const settled = await Promise.allSettled(
        batch.map((lender) => enrichAndScoreLender(lender, { allowPaidHunter: paidHunterEnabled }))
      )
      outcomes.push(...settled.map((item, index) => {
        if (item.status === 'fulfilled') return item.value
        const lender = batch[index]
        return {
          scored: null,
          failed: true,
          hunterAttempted: false,
          result: {
            lenderId: lender.id,
            name: lender.name,
            confidenceScore: null,
            status: 'error',
            reason: 'worker_rejected',
          },
        }
      }))
    }

    const summary = summarizeLenderScoringOutcomes(outcomes)
    const results = outcomes.map((outcome) => outcome.result)
    const errorMessage = summary.ok
      ? null
      : `${summary.errorCount} of ${results.length} lender scoring or Hunter enrichment record(s) failed.`
    await finishLenderOutreachRun(run.id, {
      status: summary.ok ? 'completed' : summary.partial ? 'partial' : 'failed',
      resultCount: results.length,
      errorMessage,
    })
    return {
      ...summary,
      configured: paidHunterEnabled,
      count: results.length,
      results,
      hunter: {
        enabled: paidHunterEnabled,
        attempted: summary.hunterAttempted,
        limit: hunterLookupLimit,
        concurrency,
      },
      ...(errorMessage ? { error: errorMessage } : {}),
    }
  } catch (error) {
    await finishLenderOutreachRun(run.id, {
      status: 'failed',
      resultCount: 0,
      errorMessage: 'Lender scoring and Hunter enrichment stage failed.',
    })
    throw error
  }
}

export async function runDailyLenderOutreach(limit = 40) {
  const lenders = await listLendersNeedingOutreach(limit)
  const results: Array<{ lenderId: string; name: string; messageCount: number }> = []
  for (const lender of lenders) {
    const messages = await generateAndStoreLenderOutreach(lender)
    results.push({ lenderId: lender.id, name: lender.name, messageCount: messages.length })
  }
  return { ok: true, count: results.length, results }
}

export async function runDailyLenderFollowup(limit = 30, options: { dryRun?: boolean } = {}) {
  const lenders = await listLendersNeedingFollowup(limit)
  const minimumScore = envInt('LENDER_AUTO_APPROVE_MIN_SCORE', 40)
  const results: Array<{ lenderId: string; name: string; action: string; reason?: string }> = []
  for (const lender of lenders) {
    if (['responded', 'reviewing', 'active_partner'].includes(lender.relationship_stage)) {
      if (!options.dryRun) {
        await createAdminTask({
          title: `Lender relationship follow-up: ${lender.name}`,
          description: 'This lender has replied or is active. Capture its lending box and route the relationship manually instead of sending another automated email.',
          taskType: 'lender_relationship_followup',
          assignedTo: lender.owner_user_id || null,
          priority: 'high',
          entityType: 'lender',
          entityId: lender.id,
          dueAt: adminTaskDueDates.now(),
          metadata: { lenderId: lender.id, relationshipStage: lender.relationship_stage },
        }).catch(() => null)
        await updateLenderRecord(lender.id, { next_follow_up_at: null })
      }
      results.push({ lenderId: lender.id, name: lender.name, action: 'manual_relationship_followup' })
      continue
    }

    const message = await getReviewableLenderOutreachMessageByChannel(lender.id, 'email_followup')
    if (!message) {
      if (!options.dryRun) await updateLenderRecord(lender.id, { next_follow_up_at: null })
      results.push({ lenderId: lender.id, name: lender.name, action: 'blocked', reason: 'missing_followup_message' })
      continue
    }

    const decision = evaluateLenderAutoApproval({
      lender,
      message,
      templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
      minimumScore,
      allowedChannels: ['email_followup'],
    })
    if (!decision.approved || !isUsableContactEmail(lender.contact_email)) {
      if (!options.dryRun) {
        await createAdminTask({
          title: `Lender follow-up blocked: ${lender.name}`,
          description: `The guarded lender follow-up stopped at the safety gate: ${decision.reason}.`,
          taskType: 'lender_autopilot_blocked',
          priority: 'high',
          entityType: 'lender',
          entityId: lender.id,
          dueAt: adminTaskDueDates.now(),
          metadata: { lenderId: lender.id, reason: decision.reason, messageId: message.id },
        }).catch(() => null)
        await updateLenderRecord(lender.id, { next_follow_up_at: null })
      }
      results.push({ lenderId: lender.id, name: lender.name, action: 'blocked', reason: decision.reason })
      continue
    }

    if (!options.dryRun) {
      const approvedAt = new Date().toISOString()
      const approvedMessage = await approveLenderFollowupMessageIfReviewable(message.id, approvedAt)
      if (!approvedMessage) {
        results.push({
          lenderId: lender.id,
          name: lender.name,
          action: 'skipped',
          reason: 'message_state_changed',
        })
        continue
      }
      await updateLenderRecord(lender.id, {
        relationship_stage: 'contacted',
        outreach_status: 'approved',
        next_follow_up_at: null,
      })
    }
    results.push({
      lenderId: lender.id,
      name: lender.name,
      action: options.dryRun ? 'would_approve_followup' : 'followup_approved',
    })
  }
  return { ok: true, count: results.length, results }
}

export async function runDailyLenderPerformanceRollup() {
  const admin = createAdminClient()
  const { data: lenders } = await admin.from('lenders').select('*').limit(250)
  const results: Array<{ lenderId: string; name: string; sent: number; responded: number; activeMatches: number }> = []

  for (const lender of (lenders || []) as LenderRecord[]) {
    const [{ count: sentCount }, { count: failedCount }, { count: respondedCount }, { count: activeMatchCount }] = await Promise.all([
      admin.from('lender_outreach_messages').select('*', { count: 'exact', head: true }).eq('lender_id', lender.id).eq('status', 'sent'),
      admin.from('lender_outreach_messages').select('*', { count: 'exact', head: true }).eq('lender_id', lender.id).eq('status', 'failed'),
      admin.from('lender_relationship_events').select('*', { count: 'exact', head: true }).eq('lender_id', lender.id).eq('event_type', 'responded'),
      admin.from('lender_matches').select('*', { count: 'exact', head: true }).eq('lender_id', lender.id).in('status', ['active', 'shared', 'reviewed']),
    ])

    const saved = await updateLenderPerformance(lender.id, {
      outreach_sent_count: sentCount || 0,
      outreach_failed_count: failedCount || 0,
      response_count: respondedCount || 0,
      active_match_count: activeMatchCount || 0,
      average_match_score: lender.confidence_score || 0,
      last_contacted_at: lender.last_contacted_at,
    })

    results.push({
      lenderId: lender.id,
      name: lender.name,
      sent: saved.outreach_sent_count,
      responded: saved.response_count,
      activeMatches: saved.active_match_count,
    })
  }

  return { ok: true, count: results.length, results }
}

export async function listApprovedLenderMessagesForSend(limit = 20) {
  return listApprovedLenderEmailOutreach(limit)
}
