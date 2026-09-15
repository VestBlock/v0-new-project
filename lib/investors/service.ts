import { randomUUID } from 'node:crypto'

import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import {
  enrichContactFromHunter,
  type HunterContactCandidate,
  type HunterContactLookupResult,
} from '@/lib/email/hunter'
import { discoverInvestorsForMarket } from '@/lib/investors/discovery'
import { sendInvestorOutreachEmail } from '@/lib/investors/outbound'
import { scoreExistingInvestor } from '@/lib/investors/scoring'
import {
  claimInvestorOutreachMessageForSend,
  claimInvestorForHunterEnrichment,
  downgradeInvestorOutreachMessageIfApproved,
  finishInvestorAutomationRun,
  generateInvestorFollowup,
  generateInvestorOutreach,
  insertInvestorEngagementEvent,
  listApprovedInvestorEmailOutreach,
  listInvestorOutreachForAutoApproval,
  listInvestorsNeedingHunterEnrichment,
  listInvestorsForScoring,
  listInvestorsNeedingFollowup,
  listInvestorsNeedingOutreach,
  restoreInvestorOutreachMessageAfterQuotaDenial,
  startInvestorAutomationRun,
  saveInvestorHunterEnrichmentResult,
  updateInvestorOutreachMessage,
  updateInvestorRecord,
  upsertInvestorProfile,
} from '@/lib/investors/repository'
import type { InvestorProfileRecord } from '@/lib/investors/types'
import { buildDiscoveryCooldownMessage, findRecentDiscoveryRun } from '@/lib/partners/discoveryCooldown'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { getDeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import { isPaidSourceBudgetSkipError } from '@/lib/leads/paidSourceBudget'
import { getOperationalReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import { evaluateInvestorAutoApproval } from '@/lib/investors/automationCore'
import { INVESTOR_OUTREACH_TEMPLATE_VERSION } from '@/lib/investors/outreach'
import { reserveInvestorHunterDailyLookup, type InvestorHunterLookupReservation } from '@/lib/investors/hunterBudget'
import { INVESTOR_HUNTER_BUDGET_HARD_LIMIT } from '@/lib/investors/hunterBudgetCore'
import { getConfiguredOutboundProvider } from '@/lib/outreach/provider-preference'
import { getOutreachRecipientGuard } from '@/lib/outreach/suppression'
import { getCommercialOutreachMailingAddress } from '@/lib/outreach/commercialCompliance'
import { reserveAutomaticEmailLaneAttempt } from '@/lib/outreach/laneAttemptQuota'
import {
  DEFAULT_DAILY_STRATEGY_OUTPUT_TARGET,
  allocateDailyStrategyOutput,
  configuredDailyStrategyOutputTarget,
} from '@/lib/outreach/dailyStrategyOutputCore'
import { preflightPartnerHunterSendVerification } from '@/lib/outreach/partnerHunterSendVerification'
import {
  hashHunterVerificationEmail,
  hunterVerificationReplacementScanLimit,
  shouldQuarantineHunterVerificationStatus,
} from '@/lib/outreach/hunterSendVerificationCore'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function selectVerifiedInvestorHunterCandidate(candidates: HunterContactCandidate[]) {
  return candidates
    .filter(
      (candidate) =>
        candidate.verificationStatus === 'valid' &&
        Number(candidate.confidence) >= 90 &&
        isUsableContactEmail(candidate.email)
    )
    .sort((left, right) => right.score - left.score || right.confidence - left.confidence)[0] || null
}

type InvestorHunterEnrichmentRecordResult = {
  investorId: string
  name: string
  status: string
  reason?:
    | 'claim_failed'
    | 'hunter_budget_reservation_failed'
    | 'investor_hunter_daily_budget_exhausted'
    | 'hunter_lookup_failed'
    | 'record_persistence_failed'
    | 'worker_rejected'
  errorStatePersisted?: boolean
}

export type InvestorHunterEnrichmentRecordOutcome = {
  enriched: boolean
  failed: boolean
  result: InvestorHunterEnrichmentRecordResult
}

type InvestorHunterEnrichmentWorkerDependencies = {
  now: () => Date
  claimInvestor: typeof claimInvestorForHunterEnrichment
  reserveLookup: (input: {
    investorId: string
    claimId: string
    now?: Date
  }) => Promise<InvestorHunterLookupReservation>
  lookupContact: (input: {
    website?: string | null
    contactName?: string | null
    budgetReservationId: string
  }) => Promise<HunterContactLookupResult>
  saveResult: typeof saveInvestorHunterEnrichmentResult
  recordEnrichedEvent: (input: {
    investorId: string
    confidence: number | null
    verificationStatus: string | null
  }) => Promise<void>
}

function errorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return null
  const code = String((error as { code?: unknown }).code || '').trim()
  return /^[a-z0-9_-]{1,32}$/i.test(code) ? code : null
}

function savedHunterStatus(investor: InvestorProfileRecord | null) {
  const enrichment = investor?.metadata_json?.hunterContactEnrichment
  if (!enrichment || typeof enrichment !== 'object') return null
  const status = (enrichment as Record<string, unknown>).status
  return typeof status === 'string' ? status : null
}

function persistenceInput(
  lookup: HunterContactLookupResult,
  checkedAt: string,
  candidate: HunterContactCandidate | null,
  claimId: string,
  reservationId: string | null
) {
  return {
    status: lookup.status,
    domain: lookup.domain,
    organization: lookup.organization,
    checkedAt,
    claimId,
    reservationId,
    candidate,
    topCandidateConfidence: lookup.primaryCandidate?.confidence ?? null,
    topCandidateVerificationStatus: lookup.primaryCandidate?.verificationStatus ?? null,
  }
}

async function persistInvestorHunterErrorState(input: {
  investor: InvestorProfileRecord
  checkedAt: string
  claimId: string
  reservationId: string | null
  lookup: HunterContactLookupResult | null
  dependencies: InvestorHunterEnrichmentWorkerDependencies
}) {
  try {
    const saved = await input.dependencies.saveResult({
      investorId: input.investor.id,
      enrichment: {
        status: 'error',
        domain: input.lookup?.domain || input.investor.website,
        organization: input.lookup?.organization || null,
        checkedAt: input.checkedAt,
        claimId: input.claimId,
        reservationId: input.reservationId,
        candidate: null,
        topCandidateConfidence: input.lookup?.primaryCandidate?.confidence ?? null,
        topCandidateVerificationStatus: input.lookup?.primaryCandidate?.verificationStatus ?? null,
      },
    })
    return Boolean(saved)
  } catch {
    return false
  }
}

async function persistDuplicateInvestorHunterContact(input: {
  investor: InvestorProfileRecord
  checkedAt: string
  claimId: string
  reservationId: string | null
  lookup: HunterContactLookupResult
  dependencies: InvestorHunterEnrichmentWorkerDependencies
}) {
  try {
    const saved = await input.dependencies.saveResult({
      investorId: input.investor.id,
      enrichment: {
        ...persistenceInput(
          input.lookup,
          input.checkedAt,
          null,
          input.claimId,
          input.reservationId
        ),
        // Keep this terminal instead of an error retry. The paid lookup was
        // valid, but another profile already owns the discovered address.
        status: 'found',
        candidate: null,
      },
    })
    return Boolean(saved)
  } catch {
    return false
  }
}

export async function processInvestorHunterEnrichmentRecord(
  investor: InvestorProfileRecord,
  dependencies: InvestorHunterEnrichmentWorkerDependencies
): Promise<InvestorHunterEnrichmentRecordOutcome> {
  const checkedAt = dependencies.now().toISOString()
  const claimId = randomUUID()
  let claimed: InvestorProfileRecord | null = null
  let reservation: InvestorHunterLookupReservation | null = null
  let lookup: HunterContactLookupResult | null = null
  let phase: 'claim' | 'budget' | 'lookup' | 'persist' = 'claim'

  try {
    claimed = await dependencies.claimInvestor({ investor, checkedAt, claimId })
    if (!claimed) {
      return {
        enriched: false,
        failed: false,
        result: { investorId: investor.id, name: investor.display_name, status: 'concurrent_claim_blocked' },
      }
    }

    phase = 'budget'
    reservation = await dependencies.reserveLookup({
      investorId: claimed.id,
      claimId,
      now: new Date(checkedAt),
    })
    if (!reservation.allowed) {
      const budgetExhausted = reservation.reason === 'investor_hunter_daily_budget_exhausted'
      phase = 'persist'
      const saved = await dependencies.saveResult({
        investorId: claimed.id,
        enrichment: {
          status: budgetExhausted ? 'skipped' : 'error',
          domain: claimed.website,
          organization: null,
          checkedAt,
          claimId,
          reservationId: null,
          budgetReason: reservation.reason || 'investor_hunter_budget_reservation_failed',
          candidate: null,
          topCandidateConfidence: null,
          topCandidateVerificationStatus: null,
        },
      })
      if (!saved) {
        return {
          enriched: false,
          failed: true,
          result: {
            investorId: claimed.id,
            name: claimed.display_name,
            status: 'error',
            reason: 'record_persistence_failed',
            errorStatePersisted: false,
          },
        }
      }

      return {
        enriched: false,
        failed: !budgetExhausted,
        result: {
          investorId: claimed.id,
          name: claimed.display_name,
          status: budgetExhausted ? 'skipped_budget' : 'error',
          reason: budgetExhausted
            ? 'investor_hunter_daily_budget_exhausted'
            : 'hunter_budget_reservation_failed',
          errorStatePersisted: !budgetExhausted,
        },
      }
    }

    phase = 'lookup'
    lookup = await dependencies.lookupContact({
      website: claimed.website,
      contactName: claimed.person_name || null,
      budgetReservationId: reservation.reservationId!,
    })
    const acceptedCandidate = selectVerifiedInvestorHunterCandidate(lookup.candidates)

    phase = 'persist'
    const saved = await dependencies.saveResult({
      investorId: claimed.id,
      enrichment: persistenceInput(
        lookup,
        checkedAt,
        acceptedCandidate,
        claimId,
        reservation.reservationId || null
      ),
    })
    if (!saved) {
      const errorStatePersisted = await persistInvestorHunterErrorState({
        investor: claimed,
        checkedAt,
        claimId,
        reservationId: reservation.reservationId || null,
        lookup,
        dependencies,
      })
      return {
        enriched: false,
        failed: true,
        result: {
          investorId: claimed.id,
          name: claimed.display_name,
          status: 'error',
          reason: 'record_persistence_failed',
          errorStatePersisted,
        },
      }
    }

    if (savedHunterStatus(saved) === 'duplicate_contact') {
      return {
        enriched: false,
        failed: false,
        result: { investorId: claimed.id, name: claimed.display_name, status: 'duplicate_contact' },
      }
    }

    const enriched = Boolean(
      acceptedCandidate &&
        saved.contact_email &&
        saved.contact_email.toLowerCase() === acceptedCandidate.email.toLowerCase()
    )
    if (enriched) {
      await dependencies.recordEnrichedEvent({
        investorId: claimed.id,
        confidence: acceptedCandidate?.confidence ?? null,
        verificationStatus: acceptedCandidate?.verificationStatus ?? null,
      }).catch(() => undefined)
    }

    if (lookup.status === 'error') {
      return {
        enriched: false,
        failed: true,
        result: {
          investorId: claimed.id,
          name: claimed.display_name,
          status: 'error',
          reason: 'hunter_lookup_failed',
          errorStatePersisted: true,
        },
      }
    }

    return {
      enriched,
      failed: false,
      result: {
        investorId: claimed.id,
        name: claimed.display_name,
        status: enriched
          ? 'enriched'
          : lookup.status === 'found'
            ? 'candidate_rejected'
            : lookup.status,
      },
    }
  } catch (error) {
    if (claimed && lookup && errorCode(error) === '23505') {
      const duplicateRecorded = await persistDuplicateInvestorHunterContact({
        investor: claimed,
        checkedAt,
        claimId,
        reservationId: reservation?.reservationId || null,
        lookup,
        dependencies,
      })
      if (duplicateRecorded) {
        return {
          enriched: false,
          failed: false,
          result: { investorId: claimed.id, name: claimed.display_name, status: 'duplicate_contact' },
        }
      }
    }

    const errorStatePersisted = claimed
      ? await persistInvestorHunterErrorState({
          investor: claimed,
          checkedAt,
          claimId,
          reservationId: reservation?.reservationId || null,
          lookup,
          dependencies,
        })
      : false
    return {
      enriched: false,
      failed: true,
      result: {
        investorId: claimed?.id || investor.id,
        name: claimed?.display_name || investor.display_name,
        status: 'error',
        reason:
          phase === 'claim'
            ? 'claim_failed'
            : phase === 'budget'
              ? 'hunter_budget_reservation_failed'
            : phase === 'lookup'
              ? 'hunter_lookup_failed'
              : 'record_persistence_failed',
        errorStatePersisted,
      },
    }
  }
}

export function summarizeInvestorHunterEnrichmentOutcomes(
  outcomes: InvestorHunterEnrichmentRecordOutcome[]
) {
  const errorCount = outcomes.filter((outcome) => outcome.failed).length
  return {
    ok: errorCount === 0,
    partial: errorCount > 0 && errorCount < outcomes.length,
    errorCount,
  }
}

export async function discoverAndIngestInvestorsForMarket(input: {
  city: string
  state: string
  metroArea?: string | null
  niches: string[]
  limitPerNiche: number
}) {
  const run = await startInvestorAutomationRun({
    runType: 'discovery',
    sourceKey: 'google_places_investors',
    requestParams: input,
  })

  try {
    const cooldownHours = envInt('INVESTOR_DISCOVERY_COOLDOWN_HOURS', 72)
    const recentRun = await findRecentDiscoveryRun({
      table: 'investor_automation_runs',
      completedAtColumn: 'finished_at',
      sourceKey: 'google_places_investors',
      city: input.city,
      state: input.state,
      cooldownHours,
    })

    if (recentRun) {
      await finishInvestorAutomationRun(run.id, {
        status: 'completed',
        resultCount: 0,
        errorMessage: buildDiscoveryCooldownMessage({
          label: 'investor',
          city: input.city,
          state: input.state,
          cooldownHours,
          completedAt: recentRun.completedAt,
        }),
      })
      return []
    }

    const discovered = await discoverInvestorsForMarket(input)
    const saved: InvestorProfileRecord[] = []
    for (const investorInput of discovered) {
      const investor = await upsertInvestorProfile(investorInput)
      saved.push(investor)
      await insertInvestorEngagementEvent({
        investorId: investor.id,
        eventType: 'note',
        eventValue: 'discovered',
        metadata: {
          source: 'google_places_investors',
          market: `${input.city}, ${input.state}`,
          sourceNames: investorInput.sourceNames || [],
        },
      })
    }

    await finishInvestorAutomationRun(run.id, { status: 'completed', resultCount: saved.length })
    return saved
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: isPaidSourceBudgetSkipError(error) ? 'completed' : 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyInvestorHunterEnrichment(limit?: number) {
  const configuredLimit = Math.min(
    INVESTOR_HUNTER_BUDGET_HARD_LIMIT,
    envInt('INVESTORS_DAILY_HUNTER_LOOKUP_LIMIT', 20)
  )
  const effectiveLimit = Math.min(Math.max(1, Math.floor(limit || configuredLimit)), configuredLimit)
  const concurrency = Math.min(5, envInt('INVESTORS_HUNTER_CONCURRENCY', 4))
  const run = await startInvestorAutomationRun({
    // The production run-type constraint predates this bounded enrichment
    // stage; keep the existing scoring type and distinguish it by source key.
    runType: 'scoring',
    sourceKey: 'hunter_investor_domain_search',
    requestParams: {
      limit: effectiveLimit,
      dailyBudgetLimit: configuredLimit,
      budgetResetTimeZone: 'America/Chicago',
      concurrency,
      cooldownDays: 30,
      errorRetryHours: 6,
    },
  })

  try {
    if (!process.env.HUNTER_API_KEY?.trim()) {
      await finishInvestorAutomationRun(run.id, {
        status: 'completed',
        resultCount: 0,
        errorMessage: 'Hunter API key is not configured; no investor records were claimed.',
      })
      return {
        ok: true,
        partial: false,
        configured: false,
        count: 0,
        enrichedCount: 0,
        errorCount: 0,
        results: [],
      }
    }

    const investors = await listInvestorsNeedingHunterEnrichment(effectiveLimit)
    const outcomes: InvestorHunterEnrichmentRecordOutcome[] = []
    let enrichedCount = 0
    const dependencies: InvestorHunterEnrichmentWorkerDependencies = {
      now: () => new Date(),
      claimInvestor: claimInvestorForHunterEnrichment,
      reserveLookup: (input) => reserveInvestorHunterDailyLookup({
        ...input,
        dailyLimit: configuredLimit,
      }),
      lookupContact: enrichContactFromHunter,
      saveResult: saveInvestorHunterEnrichmentResult,
      recordEnrichedEvent: async ({ investorId, confidence, verificationStatus }) => {
        await logEvent({
          eventType: 'admin_action',
          entityType: 'investor',
          entityId: investorId,
          metadata: {
            action: 'investor_contact_enriched',
            provider: 'hunter',
            confidence,
            verificationStatus,
          },
        })
      },
    }

    for (let offset = 0; offset < investors.length; offset += concurrency) {
      const batch = investors.slice(offset, offset + concurrency)
      const settledBatch = await Promise.allSettled(
        batch.map((investor) => processInvestorHunterEnrichmentRecord(investor, dependencies))
      )
      const batchResults = settledBatch.map((settled, index) => {
        if (settled.status === 'fulfilled') return settled.value
        const investor = batch[index]
        return {
          enriched: false,
          failed: true,
          result: {
            investorId: investor.id,
            name: investor.display_name,
            status: 'error',
            reason: 'worker_rejected' as const,
            errorStatePersisted: false,
          },
        }
      })
      enrichedCount += batchResults.filter((item) => item.enriched).length
      outcomes.push(...batchResults)
      if (
        batchResults.some(
          (item) =>
            item.result.status === 'skipped_budget' ||
            item.result.reason === 'hunter_budget_reservation_failed'
        )
      ) {
        break
      }
    }

    const summary = summarizeInvestorHunterEnrichmentOutcomes(outcomes)
    const results = outcomes.map((outcome) => outcome.result)
    const errorMessage = summary.ok
      ? null
      : `${summary.errorCount} of ${results.length} investor Hunter enrichment record(s) failed.`
    await finishInvestorAutomationRun(run.id, {
      status: summary.ok ? 'completed' : 'failed',
      resultCount: results.length,
      errorMessage,
    })
    return {
      ...summary,
      configured: true,
      count: results.length,
      enrichedCount,
      results,
      ...(errorMessage ? { error: errorMessage } : {}),
    }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: `Investor Hunter enrichment stage failed${errorCode(error) ? ` (${errorCode(error)})` : ''}.`,
    })
    throw error
  }
}

export async function runDailyInvestorScoring(limit = 100) {
  const run = await startInvestorAutomationRun({
    runType: 'scoring',
    sourceKey: 'investor_profiles',
    requestParams: { limit },
  })

  try {
    const investors = await listInvestorsForScoring(limit)
    const results: Array<{ investorId: string; name: string; score: number; sequence: string }> = []
    for (const investor of investors) {
      const score = scoreExistingInvestor(investor)
      await updateInvestorRecord(investor.id, {
        recent_activity_score: score.recentActivity,
        transaction_volume_score: score.transactionVolume,
        geographic_fit_score: score.geographicFit,
        financing_need_score: score.financingNeed,
        disposition_need_score: score.dispositionNeed,
        partnership_potential_score: score.partnershipPotential,
        partnership_score: score.partnershipScore,
        deal_flow_fit: score.dealFlowFit,
        disposition_fit: score.dispositionFit,
        financing_fit: score.financingFit,
        partnership_fit: score.partnershipFit,
        assigned_sequence: score.assignedSequence,
        last_scored_at: new Date().toISOString(),
        metadata_json: {
          ...(investor.metadata_json || {}),
          scoreSummary: score.fitSummary,
        },
      })
      results.push({ investorId: investor.id, name: investor.display_name, score: score.partnershipScore, sequence: score.assignedSequence })
    }

    await finishInvestorAutomationRun(run.id, { status: 'completed', resultCount: results.length })
    return { ok: true, count: results.length, results }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyInvestorOutreach(limit = 50) {
  const run = await startInvestorAutomationRun({
    runType: 'outreach_generation',
    sourceKey: 'investor_profiles',
    requestParams: { limit },
  })

  try {
    const investors = await listInvestorsNeedingOutreach(limit)
    const results: Array<{ investorId: string; name: string; sequence: string }> = []
    for (const investor of investors) {
      const message = await generateInvestorOutreach(investor.id)
      results.push({ investorId: investor.id, name: investor.display_name, sequence: message.sequence_code })
    }
    await finishInvestorAutomationRun(run.id, { status: 'completed', resultCount: results.length })
    return { ok: true, count: results.length, results }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyInvestorSend(limit?: number, options: { dryRun?: boolean } = {}) {
  const autoSendRequested = ['1', 'true', 'yes', 'on'].includes(String(process.env.INVESTOR_AUTO_SEND_ENABLED || '').toLowerCase())
  const outboundProvider = getConfiguredOutboundProvider()
  const deliveryCircuitBreaker = autoSendRequested
    ? await getDeliveryCircuitBreaker({ provider: outboundProvider, allowControlledTrial: true })
    : null
  const replyCapture = await getOperationalReplyCaptureReadiness()
  const mailingAddressConfigured = Boolean(getCommercialOutreachMailingAddress())
  const configuredOutputTarget = configuredDailyStrategyOutputTarget()
  const dailyLimit = allocateDailyStrategyOutput(
    Math.min(DEFAULT_DAILY_STRATEGY_OUTPUT_TARGET, configuredOutputTarget)
  ).byKey.investors
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: sentLast24h, error: sentCountError } = await createAdminClient()
    .from('investor_outreach_messages')
    .select('id', { count: 'exact', head: true })
    .not('sent_at', 'is', null)
    .gte('sent_at', since)
  if (sentCountError) throw sentCountError
  const remainingDailyCapacity = Math.max(0, dailyLimit - (sentLast24h || 0))
  const requestedLimit = limit ?? dailyLimit
  const autoSend =
    autoSendRequested &&
    deliveryCircuitBreaker?.allowed === true &&
    replyCapture.ready &&
    mailingAddressConfigured &&
    remainingDailyCapacity > 0
  const effectiveLimit = Math.max(
    0,
    Math.min(
      requestedLimit,
      remainingDailyCapacity,
      deliveryCircuitBreaker?.maxBatchSize ?? Number.POSITIVE_INFINITY
    )
  )
  const sendBlockedReasons = [
    !autoSendRequested ? 'investor_auto_send_disabled' : null,
    autoSendRequested && deliveryCircuitBreaker?.allowed !== true ? 'delivery_circuit_breaker_blocked' : null,
    !replyCapture.ready ? 'reply_capture_not_configured' : null,
    !mailingAddressConfigured ? 'mailing_address_not_configured' : null,
    remainingDailyCapacity <= 0 ? 'daily_send_limit_reached' : null,
  ].filter((reason): reason is string => Boolean(reason))
  const providerFailureStopThreshold = envInt('OUTREACH_PROVIDER_FAILURE_STOP_THRESHOLD', 5)
  let providerFailureCount = 0
  const run = await startInvestorAutomationRun({
    runType: 'outreach_send',
    sourceKey: 'investor_outreach_messages',
    requestParams: {
      requestedLimit,
      dryRun: options.dryRun || false,
      autoSend,
      dailyLimit,
      sentLast24h: sentLast24h || 0,
      sendBlockedReasons,
    },
  })

  try {
    const approved = effectiveLimit > 0
      ? await listApprovedInvestorEmailOutreach(hunterVerificationReplacementScanLimit(effectiveLimit))
      : []
    const minimumScore = envInt('INVESTOR_AUTO_APPROVE_MIN_SCORE', 45)
    const results: Array<{ investorId: string; name: string; status: string; reason?: string }> = []
    let providerAttemptCount = 0
    let hunterVerificationAttempts = 0
    let hunterVerificationBlocked = 0

    for (const row of approved) {
      if (providerAttemptCount >= effectiveLimit) break
      let investor = row.investor_profiles as InvestorProfileRecord | null
      if (!investor?.id) continue

      const approvalDecision = evaluateInvestorAutoApproval({
        investor,
        message: row,
        templateVersion: INVESTOR_OUTREACH_TEMPLATE_VERSION,
        minimumScore,
      })
      if (!approvalDecision.approved) {
        if (!options.dryRun) {
          const downgraded = await downgradeInvestorOutreachMessageIfApproved(row.id, {
            metadata_json: {
              ...(row.metadata_json || {}),
              approvalRevalidation: {
                status: 'blocked',
                reason: approvalDecision.reason,
                checkedAt: new Date().toISOString(),
              },
            },
          })
          if (!downgraded) {
            results.push({
              investorId: investor.id,
              name: investor.display_name,
              status: 'message_state_changed',
              reason: approvalDecision.reason,
            })
            continue
          }
        }
        results.push({
          investorId: investor.id,
          name: investor.display_name,
          status: 'approval_revalidation_blocked',
          reason: approvalDecision.reason,
        })
        continue
      }

      if (!autoSend) {
        results.push({ investorId: investor.id, name: investor.display_name, status: 'queued_for_review' })
        continue
      }

      if (!isUsableContactEmail(investor.contact_email)) {
        if (!options.dryRun) {
          await createAdminTask({
            title: `Investor outreach blocked: ${investor.display_name}`,
            description:
              'Approved investor outreach could not send because there is no usable email. Enrich email or route by phone, LinkedIn, Facebook, or manual partner outreach.',
            taskType: 'investor_outreach_blocked',
            priority: 'high',
            entityType: 'investor_profile',
            entityId: investor.id,
            dueAt: adminTaskDueDates.now(),
            metadata: { reason: 'invalid_email', messageId: row.id },
          }).catch(() => null)
        }
        results.push({ investorId: investor.id, name: investor.display_name, status: 'invalid_email' })
        continue
      }

      if (options.dryRun) {
        results.push({ investorId: investor.id, name: investor.display_name, status: 'would_send' })
        continue
      }

      const finalRecipientGuard = await getOutreachRecipientGuard({
        scope: 'investor',
        entityId: investor.id,
        email: investor.contact_email,
      })
      if (!finalRecipientGuard.allowed) {
        results.push({ investorId: investor.id, name: investor.display_name, status: 'suppression_blocked' })
        continue
      }

      const hunterPreflight = await preflightPartnerHunterSendVerification({
        scope: 'investor',
        entity: investor,
        messageId: row.id,
        strategyKey: 'investors',
        provider: outboundProvider,
        isFollowup: row.step_number > 1,
        deliveryCircuitBreaker: deliveryCircuitBreaker || undefined,
        allowNetwork:
          hunterVerificationAttempts < hunterVerificationReplacementScanLimit(effectiveLimit),
      })
      if (hunterPreflight.creditReserved) hunterVerificationAttempts += 1
      if (hunterPreflight.cache) {
        investor = {
          ...investor,
          metadata_json: {
            ...(investor.metadata_json || {}),
            hunterSendVerification: hunterPreflight.cache,
          },
        }
      }
      if (!hunterPreflight.allowed) {
        hunterVerificationBlocked += 1
        if (
          hunterPreflight.deferredScope === 'record' &&
          shouldQuarantineHunterVerificationStatus(hunterPreflight.status)
        ) {
          await downgradeInvestorOutreachMessageIfApproved(row.id, {
            send_error: `hunter_verification:${hunterPreflight.status}`,
            metadata_json: {
              ...(row.metadata_json || {}),
              hunterSendVerificationBlocked: hunterPreflight.cache || {
                status: hunterPreflight.status,
                reason: hunterPreflight.reason,
              },
            },
          }).catch(() => null)
        }
        results.push({
          investorId: investor.id,
          name: investor.display_name,
          status: 'hunter_preflight_blocked',
          reason: hunterPreflight.reason,
        })
        if (hunterPreflight.deferredScope !== 'record') break
        continue
      }

      const claimed = await claimInvestorOutreachMessageForSend(row.id, row.updated_at)
      if (!claimed) {
        results.push({ investorId: investor.id, name: investor.display_name, status: 'duplicate_claim_blocked' })
        continue
      }

      let laneAttemptReservation
      try {
        laneAttemptReservation = await reserveAutomaticEmailLaneAttempt({
          lane: 'investor',
          messageId: claimed.id,
          claimId: `${claimed.id}:${claimed.updated_at}`,
          dailyLimit,
        })
      } catch {
        const restored = await restoreInvestorOutreachMessageAfterQuotaDenial(
          claimed.id,
          claimed.updated_at
        ).catch(() => null)
        results.push({
          investorId: investor.id,
          name: investor.display_name,
          status: restored
            ? 'automatic_email_attempt_quota_unavailable'
            : 'automatic_email_attempt_quota_restore_failed',
        })
        break
      }
      if (!laneAttemptReservation.allowed) {
        const restored = await restoreInvestorOutreachMessageAfterQuotaDenial(
          claimed.id,
          claimed.updated_at
        ).catch(() => null)
        results.push({
          investorId: investor.id,
          name: investor.display_name,
          status: restored
            ? laneAttemptReservation.reason || 'automatic_email_attempt_quota_denied'
            : 'automatic_email_attempt_quota_restore_failed',
        })
        break
      }

      providerAttemptCount += 1
      const sent = await sendInvestorOutreachEmail({
        investor,
        message: claimed,
        deliveryCircuitBreaker: deliveryCircuitBreaker || undefined,
      })
      if (!sent.ok && sent.deferred) {
        const restored = await restoreInvestorOutreachMessageAfterQuotaDenial(
          claimed.id,
          claimed.updated_at
        ).catch(() => null)
        results.push({
          investorId: investor.id,
          name: investor.display_name,
          status: restored ? 'delivery_deferred' : 'delivery_deferred_restore_failed',
        })
        if (!restored || sent.deferredScope !== 'record') break
        continue
      }
      if (!sent.ok) {
        await updateInvestorOutreachMessage(row.id, {
          status: 'failed',
          send_provider: sent.provider,
          send_error: sent.error || 'Send failed.',
          metadata_json: {
            ...(claimed.metadata_json || {}),
            idempotencyKey: sent.idempotencyKey || null,
            correlationId: sent.correlationId || null,
          },
        })
        await updateInvestorRecord(investor.id, { outreach_status: 'failed' })
        await createAdminTask({
          title: `Investor outreach send failed: ${investor.display_name}`,
          description: 'Approved investor outreach failed during auto-send. Review provider status and recipient quality before retrying.',
          taskType: 'investor_outreach_send_failed',
          priority: 'urgent',
          entityType: 'investor_profile',
          entityId: investor.id,
          dueAt: adminTaskDueDates.now(),
          metadata: { reason: sent.error || 'send_failed', messageId: row.id, provider: sent.provider },
        }).catch(() => null)
        results.push({ investorId: investor.id, name: investor.display_name, status: 'failed' })
        providerFailureCount += 1
        if (providerFailureCount >= providerFailureStopThreshold) break
        continue
      }

      providerFailureCount = 0

      const now = new Date().toISOString()
      await updateInvestorOutreachMessage(row.id, {
        status: 'sent',
        sent_at: now,
        send_provider: sent.provider,
        send_error: null,
        metadata_json: {
          ...(claimed.metadata_json || {}),
          providerMessageId: sent.providerMessageId || null,
          providerAcceptedAt: now,
          idempotencyKey: sent.idempotencyKey || null,
          correlationId: sent.correlationId || null,
          acceptedRecipientHash: hashHunterVerificationEmail(investor.contact_email || ''),
        },
      })
      await updateInvestorRecord(investor.id, {
        relationship_stage: 'contacted',
        outreach_status: 'sent',
        last_contacted_at: now,
        next_follow_up_at: adminTaskDueDates.days(4),
      })
      await insertInvestorEngagementEvent({
        investorId: investor.id,
        outreachMessageId: row.id,
        eventType: 'note',
        eventValue: 'outreach_sent',
        metadata: { provider: sent.provider, sequenceCode: row.sequence_code },
      })
      await logEvent({
        eventType: 'admin_action',
        entityType: 'investor_profile',
        entityId: investor.id,
        metadata: { action: 'investor_outreach_sent', messageId: row.id, provider: sent.provider },
      })
      await recordOutboundEnrollment({
        strategyKey: 'investor-network',
        channel: 'email',
        status: 'accepted',
        messageId: row.id,
        recipient: investor.contact_email,
        market: investor.markets?.[0] || null,
        nextActionAt: adminTaskDueDates.days(4),
        metadata: {
          investorId: investor.id,
          investorType: investor.primary_investor_type,
          provider: sent.provider,
          providerMessageId: sent.providerMessageId || null,
          idempotencyKey: sent.idempotencyKey || null,
          correlationId: sent.correlationId || null,
        },
      }).catch(() => null)
      results.push({ investorId: investor.id, name: investor.display_name, status: 'accepted' })
    }

    const operationalFailureCount = results.filter((result) =>
      result.status === 'failed' ||
      (result.status.startsWith('automatic_email_') && result.status !== 'automatic_email_daily_attempt_quota_exhausted')
    ).length
    await finishInvestorAutomationRun(run.id, {
      status: operationalFailureCount === 0 ? 'completed' : 'failed',
      resultCount: results.length,
      errorMessage: operationalFailureCount > 0
        ? `${operationalFailureCount} investor send operation(s) failed.`
        : null,
    })
    return {
      ok: operationalFailureCount === 0,
      operationalFailureCount,
      count: results.length,
      results,
      autoSendEnabled: autoSend,
      autoSendRequested,
      deliveryCircuitBreaker,
      replyCapture,
      mailingAddressConfigured,
      dailyLimit,
      sentLast24h: sentLast24h || 0,
      remainingDailyCapacity,
      sendBlockedReasons,
      effectiveLimit,
      providerAttemptCount,
      hunterVerificationAttempts,
      hunterVerificationBlocked,
    }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyInvestorApproval(limit = 25, options: { dryRun?: boolean } = {}) {
  const minimumScore = envInt('INVESTOR_AUTO_APPROVE_MIN_SCORE', 45)
  const candidates = await listInvestorOutreachForAutoApproval(limit)
  const results: Array<{ investorId: string | null; name: string; status: string; reason: string }> = []
  for (const message of candidates) {
    const investor = message.investor_profiles as InvestorProfileRecord | null
    const decision = evaluateInvestorAutoApproval({
      investor,
      message,
      templateVersion: INVESTOR_OUTREACH_TEMPLATE_VERSION,
      minimumScore,
    })
    if (!decision.approved || !investor) {
      results.push({ investorId: investor?.id || null, name: investor?.display_name || 'Unknown investor', status: 'blocked', reason: decision.reason })
      continue
    }
    if (!options.dryRun) {
      await updateInvestorOutreachMessage(message.id, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        send_error: null,
      })
      await updateInvestorRecord(investor.id, { outreach_status: 'approved', relationship_stage: 'outreach_ready' })
      await logEvent({
        eventType: 'outreach_approved',
        entityType: 'investor_profile',
        entityId: investor.id,
        metadata: { messageId: message.id, templateVersion: INVESTOR_OUTREACH_TEMPLATE_VERSION, minimumScore },
      })
    }
    results.push({
      investorId: investor.id,
      name: investor.display_name,
      status: options.dryRun ? 'would_approve' : 'approved',
      reason: decision.reason,
    })
  }
  return {
    ok: true,
    count: results.filter((result) => ['approved', 'would_approve'].includes(result.status)).length,
    reviewed: results.length,
    minimumScore,
    results,
  }
}

export async function runDailyInvestorFollowup(limit = 30, options: { dryRun?: boolean } = {}) {
  const run = await startInvestorAutomationRun({
    runType: 'followup',
    sourceKey: 'investor_profiles',
    requestParams: { limit },
  })

  try {
    const investors = await listInvestorsNeedingFollowup(limit)
    const results: Array<{ investorId: string; name: string; action: string }> = []
    for (const investor of investors) {
      if (['responded', 'qualified', 'active_buyer', 'active_borrower', 'active_partner', 'revenue_opportunity'].includes(investor.relationship_stage)) {
        if (!options.dryRun) {
          await createAdminTask({
            title: `Investor relationship follow-up: ${investor.display_name}`,
            description: 'This investor or partner has replied or qualified. Capture the buy box, lending need, disposition need, or submission path manually instead of sending another automated email.',
            taskType: 'investor_relationship_followup',
            assignedTo: investor.owner_user_id || null,
            priority: 'high',
            entityType: 'investor_profile',
            entityId: investor.id,
            dueAt: adminTaskDueDates.now(),
            metadata: { investorId: investor.id, sequence: investor.assigned_sequence, relationshipStage: investor.relationship_stage },
          }).catch(() => null)
          await updateInvestorRecord(investor.id, { next_follow_up_at: null })
        }
        results.push({ investorId: investor.id, name: investor.display_name, action: 'manual_relationship_followup' })
        continue
      }

      if (!options.dryRun) {
        await generateInvestorFollowup(investor)
        await updateInvestorRecord(investor.id, {
          relationship_stage: 'contacted',
          outreach_status: 'needs_review',
          next_follow_up_at: null,
        })
      }
      results.push({ investorId: investor.id, name: investor.display_name, action: options.dryRun ? 'would_generate_followup' : 'followup_generated' })
    }

    await finishInvestorAutomationRun(run.id, { status: 'completed', resultCount: results.length })
    return { ok: true, count: results.length, results }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyInvestorPerformanceRollup() {
  const admin = createAdminClient()
  const run = await startInvestorAutomationRun({
    runType: 'performance_rollup',
    sourceKey: 'investor_engagement_events',
    requestParams: {},
  })

  try {
    const { data: investors } = await admin.from('investor_profiles').select('*').limit(500)
    const results: Array<{ investorId: string; name: string; opens: number; replies: number; revenueEvents: number }> = []

    for (const investor of (investors || []) as InvestorProfileRecord[]) {
      const [{ count: opens }, { count: replies }, { count: revenueEvents }] = await Promise.all([
        admin.from('investor_engagement_events').select('*', { count: 'exact', head: true }).eq('investor_profile_id', investor.id).eq('event_type', 'open'),
        admin.from('investor_engagement_events').select('*', { count: 'exact', head: true }).eq('investor_profile_id', investor.id).eq('event_type', 'reply'),
        admin
          .from('investor_engagement_events')
          .select('*', { count: 'exact', head: true })
          .eq('investor_profile_id', investor.id)
          .in('event_type', ['call_booked', 'lending_request', 'deal_submitted', 'deal_sold', 'funding_closed']),
      ])

      await updateInvestorRecord(investor.id, {
        automation_flags_json: {
          ...(investor.automation_flags_json || {}),
          performance: {
            opens: opens || 0,
            replies: replies || 0,
            revenueEvents: revenueEvents || 0,
            rolledUpAt: new Date().toISOString(),
          },
        },
      })
      results.push({ investorId: investor.id, name: investor.display_name, opens: opens || 0, replies: replies || 0, revenueEvents: revenueEvents || 0 })
    }

    await finishInvestorAutomationRun(run.id, { status: 'completed', resultCount: results.length })
    return { ok: true, count: results.length, results }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
