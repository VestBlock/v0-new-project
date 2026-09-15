import { randomUUID } from 'node:crypto'

import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { queueSeoForBuyerRecord } from '@/lib/content/entitySeoExpansion'
import { enrichContactFromHunter } from '@/lib/email/hunter'
import { companyWebsiteDomain } from '@/lib/email/companyDomain'
import {
  reserveBuyerHunterDailyLookup,
  type BuyerHunterLookupReservation,
} from '@/lib/buyers/hunterBudget'
import { discoverBuyersForMarket } from '@/lib/buyers/discovery'
import { matchPropertyToBuyers } from '@/lib/buyers/matching'
import { BUYER_OUTREACH_TEMPLATE_VERSION, generateBuyerOutreach } from '@/lib/buyers/outreach'
import { evaluateBuyerAutoApproval } from '@/lib/buyers/automationCore'
import {
  addBuyerNote,
  approveBuyerFollowupMessageIfReviewable,
  claimBuyerForHunterEnrichment,
  createBuyerPacket,
  finishBuyerOutreachRun,
  getBuyerRecordById,
  getReviewableBuyerOutreachMessageByChannel,
  insertBuyerRelationshipEvent,
  listActiveBuyersWithBuyBoxes,
  listBuyersForScoring,
  listBuyersNeedingFollowup,
  listBuyersNeedingOutreach,
  replaceBuyerBuyBoxes,
  saveBuyerOutreachMessages,
  saveBuyerScore,
  startBuyerOutreachRun,
  updateBuyerPerformance,
  updateBuyerRecord,
  updateBuyerRecordIfVersion,
  upsertBuyer,
  upsertBuyerMatch,
  upsertDealPipelineItem,
} from '@/lib/buyers/repository'
import { scoreBuyer } from '@/lib/buyers/scoring'
import { analyzeBuyerWebsite } from '@/lib/buyers/site-analysis'
import type { BuyerBuyBoxRecord, BuyerRecord, PropertyBuyerMatchInput } from '@/lib/buyers/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { buildDiscoveryCooldownMessage, findRecentDiscoveryRun } from '@/lib/partners/discoveryCooldown'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const BUYER_HUNTER_TERMINAL_COOLDOWN_DAYS = 30
const BUYER_HUNTER_ERROR_RETRY_HOURS = 6
const BUYER_HUNTER_STALE_CLAIM_HOURS = 2

export function isBuyerHunterEnrichmentEligible(
  buyer: Pick<BuyerRecord, 'contact_email' | 'website' | 'metadata_json'>,
  now = new Date()
) {
  if (isUsableContactEmail(buyer.contact_email) || !companyWebsiteDomain(buyer.website)) return false
  const raw = buyer.metadata_json?.hunterContactEnrichment
  if (!raw || typeof raw !== 'object') return true
  const state = raw as Record<string, unknown>
  const checkedAt = typeof state.checkedAt === 'string' ? Date.parse(state.checkedAt) : Number.NaN
  if (!Number.isFinite(checkedAt)) return true
  const ageMs = now.getTime() - checkedAt
  if (ageMs < 0) return false
  const status = typeof state.status === 'string' ? state.status : null
  if (status === 'checking') return ageMs >= BUYER_HUNTER_STALE_CLAIM_HOURS * 3600000
  if (status === 'error' || status === 'skipped' || status === 'skipped_budget') {
    return ageMs >= BUYER_HUNTER_ERROR_RETRY_HOURS * 3600000
  }
  return ageMs >= BUYER_HUNTER_TERMINAL_COOLDOWN_DAYS * 86400000
}

function buildBuyBoxesFromAnalysis(buyer: BuyerRecord, analysis: Awaited<ReturnType<typeof analyzeBuyerWebsite>>): Array<Partial<BuyerBuyBoxRecord>> {
  const assetTypes: string[] = []
  if (['land_buyer'].includes(buyer.category)) assetTypes.push('land')
  if (['commercial_buyer', 'mixed_use_buyer', 'self_storage_buyer', 'mobile_home_park_buyer'].includes(buyer.category)) assetTypes.push('commercial')
  if (['small_multifamily_buyer'].includes(buyer.category)) assetTypes.push('multifamily')
  if (!assetTypes.length) assetTypes.push('single_family')

  return [
    {
      buy_box_name: 'Primary acquisition box',
      asset_types: assetTypes,
      states: buyer.headquarters_state ? [buyer.headquarters_state] : [],
      metros: buyer.headquarters_city ? [buyer.headquarters_city] : [],
      occupancy_preference:
        buyer.category === 'hedge_fund_buyer' || buyer.category === 'sfr_aggregator' ? 'occupied_or_rent_ready' : null,
      distressed_tolerance:
        ['local_cash_buyer', 'fix_and_flip_buyer', 'wholesaler_buyer', 'brrrr_buyer'].includes(buyer.category) ? 8 : 5,
      code_violation_tolerance:
        ['local_cash_buyer', 'fix_and_flip_buyer', 'wholesaler_buyer'].includes(buyer.category) ? 8 : 4,
      tenant_occupied_allowed: ['landlord_buyer', 'brrrr_buyer', 'small_multifamily_buyer', 'hedge_fund_buyer', 'sfr_aggregator'].includes(buyer.category),
      section8_allowed: ['landlord_buyer', 'small_multifamily_buyer'].includes(buyer.category),
      price_min: null,
      price_max: null,
      arv_min: null,
      arv_max: null,
      rehab_budget_max: ['fix_and_flip_buyer', 'brrrr_buyer'].includes(buyer.category) ? 150000 : null,
      preferred_deal_types:
        buyer.category === 'creative_finance_buyer'
          ? ['creative_finance', 'subject_to', 'seller_finance']
          : buyer.category === 'wholesaler_buyer'
            ? ['assignment', 'cash_purchase']
            : ['cash_purchase'],
      closing_speed: analysis.closingSpeed || buyer.closing_speed || null,
      proof_of_funds_status: analysis.proofOfFundsSignal || buyer.proof_of_funds_status || null,
      creative_finance_open: ['creative_finance_buyer', 'wholesaler_buyer'].includes(buyer.category),
      institutional_criteria: analysis.likelyInstitutional ? 'Institutional acquisitions language detected on buyer website.' : null,
      bilingual_support: analysis.bilingualSupport || buyer.bilingual_support,
      spanish_support: analysis.spanishSupport || buyer.spanish_support,
      active: true,
      notes: analysis.summary,
      metadata_json: {
        websiteCategories: analysis.categories,
      },
    },
  ]
}

export async function discoverAndIngestBuyersForMarket(input: {
  city: string
  state: string
  metroArea?: string | null
  niches: string[]
  limitPerNiche: number
}) {
  const run = await startBuyerOutreachRun({
    runType: 'discovery',
    sourceKey: 'google_places_buyers',
    requestParams: input,
  })

  try {
    const cooldownHours = envInt('BUYER_DISCOVERY_COOLDOWN_HOURS', 72)
    const recentRun = await findRecentDiscoveryRun({
      table: 'buyer_outreach_runs',
      completedAtColumn: 'completed_at',
      sourceKey: 'google_places_buyers',
      city: input.city,
      state: input.state,
      cooldownHours,
    })

    if (recentRun) {
      await finishBuyerOutreachRun(run.id, {
        status: 'partial',
        resultCount: 0,
        errorMessage: buildDiscoveryCooldownMessage({
          label: 'buyer',
          city: input.city,
          state: input.state,
          cooldownHours,
          completedAt: recentRun.completedAt,
        }),
      })
      return []
    }

    const raw = await discoverBuyersForMarket({
      city: input.city,
      state: input.state,
      metroArea: input.metroArea,
      niches: input.niches,
      limitPerNiche: input.limitPerNiche,
      provider: 'auto',
    })

    const saved: BuyerRecord[] = []
    for (const buyerInput of raw) {
      const buyer = await upsertBuyer(buyerInput)
      saved.push(buyer)
      await insertBuyerRelationshipEvent({
        buyerId: buyer.id,
        eventType: 'discovered',
        metadata: {
          source: buyer.source,
          market: `${input.city}, ${input.state}`,
          niche: buyerInput.metadata?.niche || null,
        },
      })
      await queueSeoForBuyerRecord({
        id: buyer.id,
        name: buyer.name,
        category: buyer.category,
        headquarters_city: buyer.headquarters_city,
        headquarters_state: buyer.headquarters_state,
        relationship_stage: buyer.relationship_stage,
      }).catch((error) => {
        console.warn('[entity-seo] buyer queue skipped:', error)
      })
    }

    await finishBuyerOutreachRun(run.id, { status: 'completed', resultCount: saved.length })
    return saved
  } catch (error) {
    await finishBuyerOutreachRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function enrichAndScoreBuyer(
  buyer: BuyerRecord,
  options: {
    allowPaidHunter?: boolean
    onHunterReservation?: (reservation: BuyerHunterLookupReservation) => void
  } = {}
) {
  const analysis = await analyzeBuyerWebsite(buyer.website)
  const currentContactEmail = isUsableContactEmail(buyer.contact_email) ? buyer.contact_email : null
  const websiteContactEmail = isUsableContactEmail(analysis.contactEmail) ? analysis.contactEmail : null
  const publicContactEmail = currentContactEmail || websiteContactEmail
  const hunterDailyLimit = Math.min(25, envInt('BUYERS_DAILY_HUNTER_LOOKUP_LIMIT', 10))
  let writeBase = buyer
  let hunterClaimId: string | null = null
  let hunterResult: Awaited<ReturnType<typeof enrichContactFromHunter>> | null = null
  let hunterReservation: BuyerHunterLookupReservation | null = null
  const existingHunterState = buyer.metadata_json?.hunterContactEnrichment
  const existingHunterRecord = existingHunterState && typeof existingHunterState === 'object'
    ? existingHunterState as Record<string, unknown>
    : null
  const existingClaimCheckedAt = typeof existingHunterRecord?.checkedAt === 'string'
    ? Date.parse(existingHunterRecord.checkedAt)
    : Number.NaN
  const existingClaimAgeMs = Date.now() - existingClaimCheckedAt
  const freshHunterClaim =
    existingHunterRecord?.status === 'checking' &&
    Number.isFinite(existingClaimCheckedAt) &&
    existingClaimAgeMs < BUYER_HUNTER_STALE_CLAIM_HOURS * 3600000

  if (!currentContactEmail && freshHunterClaim) return buyer

  if (
    options.allowPaidHunter &&
    !publicContactEmail &&
    buyer.website &&
    isBuyerHunterEnrichmentEligible(buyer)
  ) {
    const claimId = randomUUID()
    const claimed = await claimBuyerForHunterEnrichment({ buyer, claimId })
    if (claimed) {
      writeBase = claimed
      hunterClaimId = claimId
      try {
        hunterReservation = await reserveBuyerHunterDailyLookup({
          buyerId: claimed.id,
          claimId,
          dailyLimit: hunterDailyLimit,
        })
      } catch {
        hunterReservation = {
          allowed: false,
          reason: 'buyer_hunter_budget_reservation_failed',
          attemptCount: 0,
          remaining: 0,
        }
      }
      options.onHunterReservation?.(hunterReservation)

      if (hunterReservation.allowed) {
        hunterResult = await enrichContactFromHunter({
          website: claimed.website,
          contactName: claimed.contact_name || null,
        })
      }
    } else {
      return (await getBuyerRecordById(buyer.id)) || buyer
    }
  }

  const verifiedHunterContact = hunterResult?.candidates.find(
    (candidate) =>
      candidate.verificationStatus === 'valid' &&
      candidate.confidence >= 90 &&
      isUsableContactEmail(candidate.email)
  ) || null

  const effectiveContactEmail = isUsableContactEmail(writeBase.contact_email)
    ? writeBase.contact_email
    : websiteContactEmail || verifiedHunterContact?.email || null
  const checkedAt = new Date().toISOString()
  const hunterMetadata = hunterResult
    ? {
        provider: 'hunter',
        status: hunterResult.status,
        domain: hunterResult.domain,
        organization: hunterResult.organization,
        checkedAt,
        claimId: hunterClaimId,
        reservationId: hunterReservation?.reservationId || null,
        accepted: Boolean(verifiedHunterContact),
        acceptedConfidence: verifiedHunterContact?.confidence ?? null,
        acceptedVerificationStatus: verifiedHunterContact?.verificationStatus ?? null,
        topCandidateConfidence: hunterResult.primaryCandidate?.confidence ?? null,
        topCandidateVerificationStatus: hunterResult.primaryCandidate?.verificationStatus ?? null,
      }
    : hunterClaimId
      ? {
          provider: 'hunter',
          status: hunterReservation?.reason === 'buyer_hunter_daily_budget_exhausted'
            ? 'skipped_budget'
            : 'error',
          checkedAt,
          claimId: hunterClaimId,
          reservationId: hunterReservation?.reservationId || null,
          budgetReason: hunterReservation?.reason || 'buyer_hunter_lookup_not_reserved',
          accepted: false,
        }
      : (writeBase.metadata_json?.hunterContactEnrichment as Record<string, unknown> | undefined)

  const updatedByVersion = await updateBuyerRecordIfVersion({
    buyerId: writeBase.id,
    expectedUpdatedAt: writeBase.updated_at,
    expectedContactEmail: writeBase.contact_email,
    hunterClaimId,
    updates: {
      contact_email: effectiveContactEmail,
      contact_phone: writeBase.contact_phone || analysis.contactPhone || null,
      contact_name: writeBase.contact_name || verifiedHunterContact?.fullName || null,
      bilingual_support: writeBase.bilingual_support || analysis.bilingualSupport,
      spanish_support: writeBase.spanish_support || analysis.spanishSupport,
      closing_speed: writeBase.closing_speed || analysis.closingSpeed || null,
      proof_of_funds_status: writeBase.proof_of_funds_status || analysis.proofOfFundsSignal || null,
      fit_summary: writeBase.fit_summary || analysis.summary,
      metadata_json: {
        ...(writeBase.metadata_json || {}),
        buyerSiteAnalysis: analysis,
        hunterContactEnrichment: hunterMetadata,
      },
    },
  })
  const updated = updatedByVersion || (await getBuyerRecordById(writeBase.id))
  if (!updated) throw new Error(`Buyer ${writeBase.id} no longer exists.`)

  const buyBoxes = await replaceBuyerBuyBoxes(updated.id, buildBuyBoxesFromAnalysis(updated, analysis))
  const score = scoreBuyer(updated, buyBoxes)
  const scored = await saveBuyerScore(updated.id, score, updated.metadata_json || {})
  await logEvent({
    eventType: 'buyer_scored',
    entityType: 'buyer',
    entityId: updated.id,
    metadata: { confidenceScore: score.confidenceScore, category: updated.category },
  })
  return scored
}

export async function generateAndStoreBuyerOutreach(buyer: BuyerRecord) {
  const bundle = generateBuyerOutreach(buyer)
  const saved = await saveBuyerOutreachMessages(buyer.id, [
    {
      channel: 'email_intro',
      subject: bundle.emailIntro.subject,
      body: bundle.emailIntro.body,
      cta: bundle.emailIntro.cta,
      partnershipAngle: bundle.emailIntro.partnershipAngle,
      propertyReferralAngle: bundle.emailIntro.propertyReferralAngle,
      complianceNote: bundle.emailIntro.complianceNote,
      language: 'en',
      generatedWith: bundle.generatedWith,
      metadata: {
        templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
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
      propertyReferralAngle: bundle.emailFollowup.propertyReferralAngle,
      complianceNote: bundle.emailFollowup.complianceNote,
      language: 'en',
      generatedWith: bundle.generatedWith,
      metadata: {
        templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
        qualificationQuestions: bundle.emailFollowup.qualificationQuestions,
        economicsPrompt: bundle.emailFollowup.economicsPrompt,
      },
    },
    {
      channel: 'linkedin_dm',
      body: bundle.linkedInDm.body,
      cta: bundle.linkedInDm.cta,
      partnershipAngle: bundle.linkedInDm.partnershipAngle,
      propertyReferralAngle: bundle.linkedInDm.propertyReferralAngle,
      complianceNote: bundle.linkedInDm.complianceNote,
      language: 'en',
      generatedWith: bundle.generatedWith,
      metadata: {
        templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
        qualificationQuestions: bundle.linkedInDm.qualificationQuestions,
        economicsPrompt: bundle.linkedInDm.economicsPrompt,
      },
    },
    {
      channel: 'phone_script',
      body: bundle.phoneScript.body,
      cta: bundle.phoneScript.cta,
      partnershipAngle: bundle.phoneScript.partnershipAngle,
      propertyReferralAngle: bundle.phoneScript.propertyReferralAngle,
      complianceNote: bundle.phoneScript.complianceNote,
      language: 'en',
      generatedWith: bundle.generatedWith,
      metadata: {
        templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
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
      propertyReferralAngle: bundle.spanishEmail.propertyReferralAngle,
      complianceNote: bundle.spanishEmail.complianceNote,
      language: 'es',
      generatedWith: bundle.generatedWith,
      metadata: {
        templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
        qualificationQuestions: bundle.spanishEmail.qualificationQuestions,
        economicsPrompt: bundle.spanishEmail.economicsPrompt,
      },
    },
  ])

  await updateBuyerRecord(buyer.id, {
    last_outreach_generated_at: new Date().toISOString(),
    outreach_status: 'needs_review',
    relationship_stage: buyer.relationship_stage === 'discovered' ? 'outreach_ready' : buyer.relationship_stage,
  })

  await logEvent({
    eventType: 'buyer_outreach_generated',
    entityType: 'buyer',
    entityId: buyer.id,
    metadata: { messageCount: saved.length },
  })
  return saved
}

export async function persistPropertyBuyerMatches(input: PropertyBuyerMatchInput) {
  const { buyers, buyBoxes } = await listActiveBuyersWithBuyBoxes()
  const byBuyerId = new Map<string, BuyerBuyBoxRecord[]>()
  for (const box of buyBoxes) {
    const current = byBuyerId.get(box.buyer_id) || []
    current.push(box)
    byBuyerId.set(box.buyer_id, current)
  }

  const ranked = matchPropertyToBuyers(input, buyers, byBuyerId)
  const rows = []
  for (const item of ranked) {
    const saved = await upsertBuyerMatch({
      buyerId: item.buyer.id,
      lead: input,
      confidenceScore: item.confidenceScore,
      fitSummary: item.fitSummary,
      fitExplanation: item.fitExplanation,
      nextInfoNeeded: item.nextInfoNeeded,
      fallbackBuyerCategories: item.fallbackBuyerCategories,
      metadata: {
        buyerCategory: item.buyer.category,
        buyerType: item.buyer.buyer_type,
      },
    })
    rows.push(saved)
  }

  await logEvent({
    eventType: 'buyer_match_generated',
    entityType: 'buyer_match',
    metadata: {
      leadId: input.leadId || null,
      count: rows.length,
      serviceType: input.serviceType || null,
      city: input.city || null,
      state: input.state || null,
    },
  })

  if (rows.length > 0 && input.leadId && input.propertyAddress) {
    const admin = createAdminClient()
    const { data: existingPacket } = await admin
      .from('property_buyer_packets')
      .select('id')
      .contains('metadata_json', { leadId: input.leadId })
      .limit(1)
      .maybeSingle()
    let packetId = existingPacket?.id || null
    let packetCreated = false

    if (!packetId) {
      const packet = await createBuyerPacket({
        propertyAddress: input.propertyAddress,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
        title: `Buyer routing packet: ${input.propertyAddress}`,
        summary: `New seller opportunity matched to ${rows.length} buyer record(s). Confirm title, condition, access, seller authority, and deal terms before releasing the packet.`,
        selectedBuyerCount: rows.length,
        form: {
          leadId: input.leadId,
          serviceType: input.serviceType,
          assetType: input.assetType,
          occupancy: input.occupancy,
          sellerMotivation: input.sellerMotivation,
          timelineDays: input.timelineDays,
        },
        estimate: {
          askingPrice: input.askingPrice,
          estimatedValue: input.estimatedValue,
          distressLevel: input.distressLevel,
          rehabLevel: input.rehabLevel,
          codeViolationLevel: input.codeViolationLevel,
        },
        opportunity: {
          creativeFinanceOpen: input.creativeFinanceOpen,
          landlordSignal: input.landlordSignal,
          absenteeOwner: input.absenteeOwner,
          matchCount: rows.length,
        },
        metadata: { leadId: input.leadId, matchIds: rows.map((row) => row.id), autoCreated: true },
      })
      packetId = packet.id
      packetCreated = true
    }

    await upsertDealPipelineItem({
      buyerPacketId: packetId,
      leadId: input.leadId,
      propertyAddress: input.propertyAddress,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      currentStage: 'analyzed',
      priority: input.timelineDays && input.timelineDays <= 30 ? 'urgent' : 'high',
      nextAction: 'Verify seller and property facts, then release the buyer packet to the strongest confirmed buy boxes.',
      nextActionAt: new Date().toISOString(),
      metadata: { autoCreated: true, buyerMatchCount: rows.length },
    })
    if (packetCreated) {
      await createAdminTask({
        title: `Route new seller lead to matched buyers: ${input.propertyAddress}`,
        description: `The seller lead is matched to ${rows.length} buyer record(s) and a buyer packet is ready. Verify the property facts and release it to confirmed buyers whose buy boxes fit.`,
        taskType: 'buyer_packet_ready_for_routing',
        priority: 'urgent',
        entityType: 'lead',
        entityId: input.leadId,
        dueAt: adminTaskDueDates.now(),
        metadata: { packetId, matchIds: rows.map((row) => row.id), matchCount: rows.length },
      })
    }
  }

  return rows
}

export async function addBuyerNoteAndLog(buyerId: string, authorUserId: string | null, note: string) {
  const saved = await addBuyerNote(buyerId, authorUserId, note, true)
  await logEvent({
    eventType: 'admin_action',
    actorUserId: authorUserId,
    entityType: 'buyer',
    entityId: buyerId,
    metadata: { action: 'buyer_note_added' },
  })
  return saved
}

export async function runDailyBuyerScoring(limit = 100) {
  const buyers = await listBuyersForScoring(limit)
  const results: Array<{ buyerId: string; name: string; confidenceScore: number }> = []
  const paidHunterEnabled =
    process.env.BUYER_ENRICHMENT_PREFER_FREE?.trim().toLowerCase() === 'false' &&
    Boolean(process.env.HUNTER_API_KEY?.trim())
  const hunterLookupLimit = Math.min(25, envInt('BUYERS_DAILY_HUNTER_LOOKUP_LIMIT', 10))
  const concurrency = Math.min(5, envInt('BUYERS_SCORING_CONCURRENCY', 4))
  let hunterLookupsUsed = 0

  for (let offset = 0; offset < buyers.length; offset += concurrency) {
    const batch = buyers.slice(offset, offset + concurrency)
    const scoredBuyers = await Promise.all(batch.map((buyer) =>
      enrichAndScoreBuyer(buyer, {
        allowPaidHunter: paidHunterEnabled && isBuyerHunterEnrichmentEligible(buyer),
        onHunterReservation: (reservation) => {
          if (reservation.allowed) hunterLookupsUsed += 1
        },
      })
    ))
    results.push(...scoredBuyers.map((scored) => ({
      buyerId: scored.id,
      name: scored.name,
      confidenceScore: scored.confidence_score,
    })))
  }
  return {
    ok: true,
    count: results.length,
    results,
    hunter: {
      enabled: paidHunterEnabled,
      attempted: hunterLookupsUsed,
      limit: hunterLookupLimit,
      concurrency,
    },
  }
}

export async function runDailyBuyerOutreach(limit = 40, options: { dryRun?: boolean } = {}) {
  const minimumScore = envInt('BUYER_AUTO_APPROVE_MIN_SCORE', 40)
  const buyers = await listBuyersNeedingOutreach(limit, minimumScore)
  const results: Array<{ buyerId: string; name: string; messageCount: number; status: string }> = []
  for (const buyer of buyers) {
    if (options.dryRun) {
      results.push({ buyerId: buyer.id, name: buyer.name, messageCount: 5, status: 'would_generate' })
      continue
    }
    const messages = await generateAndStoreBuyerOutreach(buyer)
    results.push({ buyerId: buyer.id, name: buyer.name, messageCount: messages.length, status: 'generated' })
  }
  return { ok: true, count: results.length, minimumScore, results }
}

export async function runDailyBuyerFollowup(limit = 30, options: { dryRun?: boolean } = {}) {
  const buyers = await listBuyersNeedingFollowup(limit)
  const minimumScore = envInt('BUYER_AUTO_APPROVE_MIN_SCORE', 40)
  const results: Array<{ buyerId: string; name: string; action: string; reason?: string }> = []
  for (const buyer of buyers) {
    if (['responded', 'reviewing', 'active_buyer'].includes(buyer.relationship_stage)) {
      if (!options.dryRun) {
        await createAdminTask({
          title: `Buyer relationship follow-up: ${buyer.name}`,
          description: 'This buyer has replied or is already active. Review the relationship manually instead of sending an automated follow-up.',
          taskType: 'buyer_relationship_followup',
          assignedTo: buyer.owner_user_id || null,
          priority: 'high',
          entityType: 'buyer',
          entityId: buyer.id,
          dueAt: adminTaskDueDates.now(),
          metadata: { buyerId: buyer.id, relationshipStage: buyer.relationship_stage },
        }).catch(() => null)
        await updateBuyerRecord(buyer.id, { next_follow_up_at: null })
      }
      results.push({ buyerId: buyer.id, name: buyer.name, action: 'manual_relationship_followup' })
      continue
    }

    const message = await getReviewableBuyerOutreachMessageByChannel(buyer.id, 'email_followup')
    if (!message) {
      if (!options.dryRun) {
        await updateBuyerRecord(buyer.id, { next_follow_up_at: null })
      }
      results.push({ buyerId: buyer.id, name: buyer.name, action: 'blocked', reason: 'missing_followup_message' })
      continue
    }

    const decision = evaluateBuyerAutoApproval({
      buyer,
      message,
      templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
      minimumScore,
      allowedChannels: ['email_followup'],
    })
    if (!decision.approved || !isUsableContactEmail(buyer.contact_email)) {
      if (!options.dryRun) {
        await createAdminTask({
          title: `Buyer follow-up blocked: ${buyer.name}`,
          description: `Automated buyer follow-up was stopped by the safety gate: ${decision.reason}. Review the buyer record before any additional contact.`,
          taskType: 'buyer_autopilot_blocked',
          assignedTo: buyer.owner_user_id || null,
          priority: 'high',
          entityType: 'buyer',
          entityId: buyer.id,
          dueAt: adminTaskDueDates.now(),
          metadata: { buyerId: buyer.id, reason: decision.reason, messageId: message.id },
        }).catch(() => null)
        await updateBuyerRecord(buyer.id, { next_follow_up_at: null })
      }
      results.push({ buyerId: buyer.id, name: buyer.name, action: 'blocked', reason: decision.reason })
      continue
    }

    if (!options.dryRun) {
      const approvedAt = new Date().toISOString()
      const approvedMessage = await approveBuyerFollowupMessageIfReviewable(message.id, approvedAt)
      if (!approvedMessage) {
        results.push({
          buyerId: buyer.id,
          name: buyer.name,
          action: 'skipped',
          reason: 'message_state_changed',
        })
        continue
      }
      await updateBuyerRecord(buyer.id, {
        relationship_stage: 'contacted',
        outreach_status: 'approved',
        next_follow_up_at: null,
      })
      await logEvent({
        eventType: 'outreach_approved',
        entityType: 'buyer',
        entityId: buyer.id,
        metadata: {
          messageId: message.id,
          templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
          approvalMode: 'guarded_followup_automation',
        },
      })
    }

    if (!options.dryRun) {
      await createAdminTask({
        title: `Buyer follow-up approved: ${buyer.name}`,
        description: 'A single guarded buyer follow-up is approved for the next capped send run. Monitor for a reply and capture the acquisition box or submission path.',
        taskType: 'buyer_relationship_followup',
        assignedTo: buyer.owner_user_id || null,
        priority: 'normal',
        entityType: 'buyer',
        entityId: buyer.id,
        dueAt: adminTaskDueDates.days(7),
        metadata: {
          buyerId: buyer.id,
          buyerCategory: buyer.category,
          relationshipStage: buyer.relationship_stage,
          messageId: message.id,
        },
      }).catch(() => null)
    }

    results.push({
      buyerId: buyer.id,
      name: buyer.name,
      action: options.dryRun ? 'would_approve_followup' : 'followup_approved',
    })
  }
  return { ok: true, count: results.length, results }
}

export async function runDailyBuyerPerformanceRollup() {
  const admin = createAdminClient()
  const { data: buyers } = await admin.from('buyers').select('*').limit(250)
  const results: Array<{ buyerId: string; name: string; sent: number; responded: number; activeMatches: number }> = []

  for (const buyer of (buyers || []) as BuyerRecord[]) {
    const [{ count: sent }, { count: responded }, { count: activeMatches }] = await Promise.all([
      admin.from('buyer_outreach_messages').select('*', { count: 'exact', head: true }).eq('buyer_id', buyer.id).eq('status', 'sent'),
      admin.from('buyer_outreach_messages').select('*', { count: 'exact', head: true }).eq('buyer_id', buyer.id).in('status', ['responded', 'approved']),
      admin.from('buyer_matches').select('*', { count: 'exact', head: true }).eq('buyer_id', buyer.id).in('status', ['matched', 'reviewed', 'shared', 'active']),
    ])

    await updateBuyerPerformance(buyer.id, {
      outreach_sent_count: sent || 0,
      response_count: responded || 0,
      active_match_count: activeMatches || 0,
      average_match_score: buyer.confidence_score,
      last_contacted_at: buyer.last_contacted_at,
    })

    results.push({
      buyerId: buyer.id,
      name: buyer.name,
      sent: sent || 0,
      responded: responded || 0,
      activeMatches: activeMatches || 0,
    })
  }

  return { ok: true, count: results.length, results }
}
