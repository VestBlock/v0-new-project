import { createHash } from 'node:crypto'
import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { sendEmail } from '@/lib/email/sendEmail'
import {
  fetchSamOpportunityDocument,
  searchFederalHierarchyApi,
  searchSamAssistanceListingsApi,
  searchSamEntitiesApi,
  searchSamExclusionsApi,
  searchSamOpportunitiesApi,
} from '@/lib/sam/api'
import {
  ensureDefaultSamWatchlists,
  finishSamAlertRun,
  getSamDashboardSummary,
  insertSamExclusionChecks,
  listActiveSamWatchlists,
  listRecentSamAlertRuns,
  listSamOpportunitiesForMatching,
  startSamAlertRun,
  updateSamOpportunityInsight,
  upsertSamAssistanceListings,
  upsertSamAwardIntelligence,
  upsertSamEntityProfiles,
  upsertSamOpportunityDocuments,
  upsertSamOpportunities,
} from '@/lib/sam/repository'
import type { SamOpportunityRecord, SamWatchlistRecord } from '@/lib/sam/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'
import { ingestNormalizedLeads } from '@/lib/leads/service'
import type { LeadRecord, NormalizedLeadInput } from '@/lib/leads/types'
import { getOpenAIClient } from '@/lib/openai-server'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function safeDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function buildOpportunityDedupeKey(row: Record<string, any>) {
  const seed = [
    row.noticeId || '',
    row.solicitationNumber || '',
    row.title || '',
    row.postedDate || '',
  ].join('|')
  return createHash('sha1').update(seed).digest('hex')
}

function buildOpportunityText(row: Record<string, any>) {
  return [
    row.title,
    row.description,
    row.type,
    row.baseType,
    row.naicsCode,
    row.classificationCode,
    row.typeOfSetAsideDescription,
    row.fullParentPathName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  )
}

function buildOpportunityDocumentTargets(opportunity: SamOpportunityRecord) {
  const targets = [
    opportunity.description_url
      ? {
          sourceUrl: opportunity.description_url,
          title: opportunity.title,
          documentType: 'description' as const,
        }
      : null,
    opportunity.additional_info_link
      ? {
          sourceUrl: opportunity.additional_info_link,
          title: `${opportunity.title} additional info`,
          documentType: 'additional_info' as const,
        }
      : null,
    ...((opportunity.resource_links || [])
      .slice(0, envInt('SAM_DOCUMENT_RESOURCE_LINK_LIMIT', 3))
      .map((sourceUrl, index) => ({
        sourceUrl,
        title: `${opportunity.title} attachment ${index + 1}`,
        documentType: 'attachment' as const,
      })) || []),
  ].filter((value): value is NonNullable<typeof value> => Boolean(value))

  return Array.from(new Map(targets.map((target) => [target.sourceUrl, target])).values())
}

function normalizeOpportunity(row: Record<string, any>) {
  const place = row.placeOfPerformance || {}
  const city = place.city?.name || row.officeAddress?.city || null
  const state = place.state?.code || row.officeAddress?.state || null
  const zip = place.zip || row.officeAddress?.zipcode || null
  const descriptionUrl =
    typeof row.description === 'string' && row.description.startsWith('http')
      ? row.description
      : null

  return {
    dedupe_key: buildOpportunityDedupeKey(row),
    notice_id: row.noticeId || null,
    solicitation_number: row.solicitationNumber || null,
    title: row.title || 'Untitled opportunity',
    opportunity_type: row.type || null,
    base_type: row.baseType || null,
    active_status: row.active || null,
    posted_date: row.postedDate || null,
    response_deadline: row.responseDeadLine || null,
    naics_code: row.naicsCode || null,
    classification_code: row.classificationCode || null,
    set_aside_code: row.typeOfSetAside || null,
    set_aside_description: row.typeOfSetAsideDescription || row.setAside || null,
    department_name: row.department || null,
    agency_name: row.subTier || row.fullParentPathName?.split('.')?.[1] || null,
    office_name: row.office || null,
    organization_path_name: row.fullParentPathName || null,
    organization_path_code: row.fullParentPathCode || null,
    organization_type: row.organizationType || null,
    city,
    state,
    zip,
    place_of_performance_json: place || {},
    office_address_json: row.officeAddress || {},
    point_of_contact_json: Array.isArray(row.pointOfContact) ? row.pointOfContact : [],
    award_json: row.award || {},
    resource_links: Array.isArray(row.resourceLinks) ? row.resourceLinks : [],
    description_url: descriptionUrl,
    additional_info_link: row.additionalInfoLink || null,
    ui_link: row.uiLink || null,
    description_excerpt: null,
    raw_json: row,
  }
}

function mapOpportunityToLead(
  opportunity: SamOpportunityRecord,
  matchedLead?: LeadRecord,
  recommendation?: Record<string, unknown>
): NormalizedLeadInput {
  return {
    leadType: 'sam_opportunity',
    source: 'sam_contract_opportunities',
    sourceUrl: opportunity.ui_link || opportunity.description_url || null,
    category: 'government_contracts',
    externalId: opportunity.notice_id || opportunity.dedupe_key,
    name: matchedLead?.name || matchedLead?.business_name || opportunity.title,
    businessName: matchedLead?.business_name || matchedLead?.name || opportunity.title,
    phone: matchedLead?.phone || null,
    email: matchedLead?.email || null,
    website: matchedLead?.website || null,
    city: matchedLead?.city || opportunity.city || null,
    state: matchedLead?.state || opportunity.state || null,
    zip: matchedLead?.zip || opportunity.zip || null,
    languageSignal: matchedLead?.language_signal || 'english',
    painSignal: `Opportunity fit for ${opportunity.title}`,
    bestOffer: 'Gov Contract Readiness',
    marketSegment: 'government_contracts',
    niche: matchedLead?.niche || opportunity.naics_code || null,
    outreachAngle: 'Bid readiness and subcontract opportunity support',
    contactInfo: {
      pointOfContact: opportunity.point_of_contact_json,
      award: opportunity.award_json,
    },
    formData: {
      solicitationNumber: opportunity.solicitation_number,
      noticeId: opportunity.notice_id,
      naicsCode: opportunity.naics_code,
      responseDeadline: opportunity.response_deadline,
      bidRecommendation: recommendation || {},
    },
    metadata: {
      linkedOpportunityId: opportunity.id,
      matchedLeadId: matchedLead?.id || null,
      agencyName: opportunity.agency_name,
      setAside: opportunity.set_aside_description,
    },
  }
}

function matchOpportunityAgainstWatchlist(opportunity: SamOpportunityRecord, watchlist: SamWatchlistRecord) {
  const haystack = buildOpportunityText(opportunity.raw_json)
  let score = 0
  const reasons: string[] = []

  const keywordHits = (watchlist.keywords || []).filter((keyword) =>
    keyword && haystack.includes(keyword.toLowerCase())
  )
  if (keywordHits.length) {
    score += Math.min(35, keywordHits.length * 12)
    reasons.push(`Keyword hit: ${keywordHits.slice(0, 3).join(', ')}`)
  }

  if (watchlist.naics_codes?.includes(String(opportunity.naics_code || ''))) {
    score += 30
    reasons.push(`NAICS match: ${opportunity.naics_code}`)
  }

  if (
    watchlist.set_asides?.length &&
    watchlist.set_asides.some((item) =>
      `${opportunity.set_aside_code || ''} ${opportunity.set_aside_description || ''}`
        .toLowerCase()
        .includes(item.toLowerCase())
    )
  ) {
    score += 15
    reasons.push('Set-aside aligned')
  }

  if (watchlist.states?.length && opportunity.state && watchlist.states.includes(opportunity.state)) {
    score += 10
    reasons.push(`State match: ${opportunity.state}`)
  }

  if (
    watchlist.agency_codes?.length &&
    watchlist.agency_codes.some((item) =>
      String(opportunity.organization_path_code || '').toLowerCase().includes(item.toLowerCase())
    )
  ) {
    score += 10
    reasons.push('Agency code aligned')
  }

  const deadline = safeDate(opportunity.response_deadline)
  if (deadline && watchlist.response_deadline_days) {
    const daysRemaining = Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysRemaining >= 0 && daysRemaining <= watchlist.response_deadline_days) {
      score += 10
      reasons.push(`Deadline within ${watchlist.response_deadline_days} days`)
    }
  }

  return {
    score: Math.min(score, 100),
    reasons,
  }
}

function matchOpportunityAgainstLead(opportunity: SamOpportunityRecord, lead: LeadRecord) {
  const haystack = buildOpportunityText(opportunity.raw_json)
  const leadText = [
    lead.category,
    lead.business_name,
    lead.name,
    lead.niche,
    lead.notes,
    lead.best_offer,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let score = 0
  if (lead.niche && haystack.includes(lead.niche.toLowerCase())) score += 25
  if (/government|contract|sam/.test(String(lead.category || ''))) score += 20
  if (/janitorial|cleaning/.test(leadText) && /janitorial|custodial|cleaning/.test(haystack)) score += 25
  if (/construction|contractor|roof/.test(leadText) && /construction|repair|roof/.test(haystack)) score += 25
  if (/software|digital|technology|ai/.test(leadText) && /software|technology|digital|it/.test(haystack)) score += 25
  if (lead.state && opportunity.state && lead.state === opportunity.state) score += 10
  return Math.min(score, 100)
}

function heuristicBidRecommendation(opportunity: SamOpportunityRecord, watchlistLabel: string, reasons: string[]) {
  const deadline = safeDate(opportunity.response_deadline)
  const daysRemaining = deadline
    ? Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const verdict =
    (opportunity.watchlist_match_count || 0) >= 2 || (opportunity.lead_match_count || 0) >= 1
      ? 'pursue'
      : opportunity.urgency_score >= 70
        ? 'review'
        : 'monitor'

  return {
    verdict,
    confidence: verdict === 'pursue' ? 'high' : verdict === 'review' ? 'medium' : 'low',
    watchlist: watchlistLabel,
    reasons,
    daysRemaining,
    nextSteps:
      verdict === 'pursue'
        ? ['Confirm NAICS fit', 'Review attachments', 'Prepare capability statement']
        : ['Monitor amendment activity', 'Validate teaming fit'],
  }
}

async function generateBidRecommendationWithAI(input: {
  opportunity: SamOpportunityRecord
  watchlistLabel: string
  reasons: string[]
}) {
  const openai = getOpenAIClient()
  if (!openai) {
    return heuristicBidRecommendation(input.opportunity, input.watchlistLabel, input.reasons)
  }

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_CONTENT_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a government contracting analyst. Return valid JSON with keys verdict, confidence, reasons, risks, nextSteps, and summary.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          watchlist: input.watchlistLabel,
          reasons: input.reasons,
          opportunity: {
            title: input.opportunity.title,
            type: input.opportunity.opportunity_type,
            naicsCode: input.opportunity.naics_code,
            setAside: input.opportunity.set_aside_description,
            agency: input.opportunity.agency_name,
            responseDeadline: input.opportunity.response_deadline,
            summary: input.opportunity.summary_json,
          },
        }),
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    return heuristicBidRecommendation(input.opportunity, input.watchlistLabel, input.reasons)
  }

  try {
    return JSON.parse(content)
  } catch {
    return heuristicBidRecommendation(input.opportunity, input.watchlistLabel, input.reasons)
  }
}

async function fetchBusinessLeadsForSam(limit = 250) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('leads')
    .select('*')
    .not('source', 'eq', 'sam_contract_opportunities')
    .not('status', 'in', '(closed,closed_won,closed_lost,disqualified,do_not_contact)')
    .order('lead_score', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as LeadRecord[]
}

async function maybeCreateHotOpportunityTask(input: {
  opportunity: SamOpportunityRecord
  recommendation: Record<string, unknown>
}) {
  const deadline = safeDate(input.opportunity.response_deadline)
  const isHot = Number(input.opportunity.urgency_score || 0) >= 70
  if (!deadline || !isHot) return

  await createAdminTask({
    title: `Review hot SAM opportunity: ${input.opportunity.title}`,
    description:
      'A SAM.gov opportunity scored as a high-priority fit. Review the match reasons, deadline, and bid recommendation before deciding whether to work it.',
    taskType: 'sam_hot_opportunity',
    priority: 'high',
    entityType: 'sam_opportunity',
    entityId: input.opportunity.id,
    dueAt: deadline.toISOString(),
    metadata: {
      noticeId: input.opportunity.notice_id,
      responseDeadline: input.opportunity.response_deadline,
      bidRecommendation: input.recommendation,
    },
  })
}

async function syncEntityProfilesFromOpportunities(opportunities: SamOpportunityRecord[]) {
  const entityNames = uniqueStrings(
    opportunities.flatMap((opportunity) => [
      ((opportunity.award_json as Record<string, any>)?.awardee?.name as string | undefined) || null,
      opportunity.agency_name,
    ])
  ).slice(0, envInt('SAM_ENTITY_SYNC_LIMIT', 6))

  if (!entityNames.length) return []
  const entities = await searchSamEntitiesApi({ legalBusinessNames: entityNames })
  const rows = entities
    .map((row) => {
      const registration = (row.entityRegistration || {}) as Record<string, any>
      const coreData = (row.coreData || {}) as Record<string, any>
      const integrity = (row.integrityInformation || {}) as Record<string, any>
      const uei = registration.ueiSAM
      if (!uei) return null
      return {
        uei_sam: String(uei),
        legal_business_name: registration.legalBusinessName || null,
        dba_name: registration.dbaName || null,
        sam_registered: registration.samRegistered || null,
        registration_status: registration.registrationStatus || null,
        purpose_of_registration: registration.purposeOfRegistrationDesc || null,
        exclusion_status_flag: registration.exclusionStatusFlag || null,
        entity_structure: registration.generalInformation?.entityStructureDesc || null,
        business_types: uniqueStrings(
          (coreData.businessTypes || []).map((item: Record<string, unknown>) => String(item.businessTypeDesc || ''))
        ),
        naics_codes: uniqueStrings(
          (coreData.naics || []).map((item: Record<string, unknown>) => String(item.naicsCode || ''))
        ),
        psc_codes: uniqueStrings(
          (coreData.psc || []).map((item: Record<string, unknown>) => String(item.pscCode || ''))
        ),
        address_json: registration.physicalAddress || {},
        points_of_contact_json: coreData.pointsOfContact || [],
        integrity_json: integrity || {},
        responsibility_information_count: Number(integrity.responsibilityInformationCount || 0),
        latest_exclusion_url: registration.exclusionURL || null,
        source_version: 'v4',
        raw_json: row,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  return upsertSamEntityProfiles(rows)
}

export async function runSamOpportunityIngest(options: { dryRun?: boolean } = {}) {
  const run = await startSamAlertRun({
    run_type: 'opportunity_ingest',
    request_params: { dryRun: Boolean(options.dryRun) },
  })

  try {
    const watchlists = await ensureDefaultSamWatchlists()
    const daysBack = envInt('SAM_OPPORTUNITY_DAYS_BACK', 21)
    const postedTo = new Date().toISOString().slice(0, 10)
    const postedFrom = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)

    const ingestedRows: Array<Record<string, unknown>> = []
    const documents: Array<Record<string, unknown>> = []

    for (const watchlist of watchlists.slice(0, envInt('SAM_WATCHLIST_BATCH_LIMIT', 6))) {
      const results = await searchSamOpportunitiesApi({
        keywords: watchlist.keywords,
        naicsCodes: watchlist.naics_codes,
        solicitationTypes: watchlist.solicitation_types,
        setAsideCodes: watchlist.set_asides,
        agencyCodes: watchlist.agency_codes,
        organizationCodes: watchlist.organization_codes,
        state: watchlist.states?.[0],
        zip: watchlist.zip_codes?.[0],
        postedFrom,
        postedTo,
        limit: envInt('SAM_OPPORTUNITY_PAGE_LIMIT', 25),
      })

      const normalized = results.map(normalizeOpportunity)
      ingestedRows.push(...normalized)
    }

    const deduped = Array.from(new Map(ingestedRows.map((row: any) => [row.dedupe_key, row])).values())
    const opportunities = options.dryRun ? (deduped as SamOpportunityRecord[]) : await upsertSamOpportunities(deduped as any)

    if (!options.dryRun) {
      for (const opportunity of opportunities.slice(0, envInt('SAM_DOCUMENT_FETCH_LIMIT', 8))) {
        const documentTargets = buildOpportunityDocumentTargets(opportunity)
        if (!documentTargets.length) continue

        for (const target of documentTargets) {
          try {
            const doc = await fetchSamOpportunityDocument({
              sourceUrl: target.sourceUrl,
              title: target.title,
              documentType: target.documentType,
            })
            documents.push({
              opportunity_id: opportunity.id,
              document_type: target.documentType,
              title: doc.title,
              source_url: doc.sourceUrl,
              fetch_status: doc.fetchStatus as any,
              content_text: doc.contentText,
              content_json: doc.contentJson,
              content_sha256: doc.contentSha256,
              fetched_at: new Date().toISOString(),
            })
          } catch (error) {
            documents.push({
              opportunity_id: opportunity.id,
              document_type: target.documentType,
              title: target.title,
              source_url: target.sourceUrl,
              fetch_status: 'failed',
              error_message: error instanceof Error ? error.message : String(error),
              fetched_at: new Date().toISOString(),
            })
          }
        }
      }

      if (documents.length) {
        await upsertSamOpportunityDocuments(documents as any)
      }
    }

    await finishSamAlertRun(run.id, {
      status: 'completed',
      matched_count: opportunities.length,
      result_summary: {
        watchlistsProcessed: watchlists.length,
        opportunitiesStored: opportunities.length,
        documentsFetched: documents.filter((item) => item.fetch_status === 'fetched').length,
      },
    })

    await logEvent({
      eventType: 'admin_action',
      entityType: 'sam_opportunity_ingest',
      entityId: run.id,
      metadata: {
        opportunitiesStored: opportunities.length,
      },
    })

    return {
      ok: true,
      watchlistsProcessed: watchlists.length,
      opportunitiesStored: opportunities.length,
      documentsFetched: documents.filter((item) => item.fetch_status === 'fetched').length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishSamAlertRun(run.id, {
      status: 'failed',
      error_message: message,
      result_summary: { error: message },
    })
    throw error
  }
}

export async function runSamMatchScoring(options: { dryRun?: boolean } = {}) {
  const run = await startSamAlertRun({
    run_type: 'match_scoring',
    request_params: { dryRun: Boolean(options.dryRun) },
  })

  try {
    const [watchlists, opportunities, leads] = await Promise.all([
      ensureDefaultSamWatchlists(),
      listSamOpportunitiesForMatching(envInt('SAM_MATCH_LIMIT', 80)),
      fetchBusinessLeadsForSam(envInt('SAM_LEAD_MATCH_LIMIT', 220)),
    ])

    let updated = 0
    let hotTasks = 0
    let convertedLeads = 0
    const syncedEntityProfiles: string[] = []

    for (const opportunity of opportunities) {
      const watchlistMatches = watchlists
        .map((watchlist) => ({
          watchlist,
          ...matchOpportunityAgainstWatchlist(opportunity, watchlist),
        }))
        .filter((row) => row.score >= envInt('SAM_WATCHLIST_MATCH_THRESHOLD', 35))
        .sort((a, b) => b.score - a.score)

      const leadMatches = leads
        .map((lead) => ({
          lead,
          score: matchOpportunityAgainstLead(opportunity, lead),
        }))
        .filter((row) => row.score >= envInt('SAM_LEAD_MATCH_THRESHOLD', 30))
        .sort((a, b) => b.score - a.score)

      const urgencyScore = Math.min(
        100,
        Math.max(
          watchlistMatches[0]?.score || 0,
          (leadMatches[0]?.score || 0) + (safeDate(opportunity.response_deadline) ? 10 : 0)
        )
      )
      const topWatchlist = watchlistMatches[0]?.watchlist
      const reasons = watchlistMatches.flatMap((match) => match.reasons).slice(0, 5)
      const recommendation = topWatchlist
        ? await generateBidRecommendationWithAI({
            opportunity,
            watchlistLabel: topWatchlist.label,
            reasons,
          })
        : heuristicBidRecommendation(opportunity, 'Unassigned', reasons)

      if (!options.dryRun) {
        await updateSamOpportunityInsight({
          opportunityId: opportunity.id,
          watchlistMatchCount: watchlistMatches.length,
          leadMatchCount: leadMatches.length,
          urgencyScore,
          bestOffer: 'Gov Contract Readiness',
          bidRecommendationJson: recommendation,
          summaryJson: {
            topWatchlist: topWatchlist?.label || null,
            watchlistMatches: watchlistMatches.slice(0, 5).map((match) => ({
              label: match.watchlist.label,
              score: match.score,
              reasons: match.reasons,
            })),
            leadMatches: leadMatches.slice(0, 5).map((match) => ({
              leadId: match.lead.id,
              businessName: match.lead.business_name || match.lead.name,
              score: match.score,
            })),
          },
          status: watchlistMatches.length || leadMatches.length ? 'matched' : 'active',
        })

        if ((recommendation.verdict === 'pursue' || urgencyScore >= 70) && topWatchlist) {
          await maybeCreateHotOpportunityTask({
            opportunity: { ...opportunity, urgency_score: urgencyScore },
            recommendation,
          })
          hotTasks += 1
        }

        if (leadMatches[0]) {
          const savedLeads = await ingestNormalizedLeads(
            'sam_contract_opportunities',
            'sam_opportunity_match',
            {
              opportunityId: opportunity.id,
              watchlist: topWatchlist?.label || null,
              recommendation,
            },
            [mapOpportunityToLead(opportunity, leadMatches[0].lead, recommendation)],
            { scoreOnIngest: true }
          )
          convertedLeads += savedLeads.length
        }
      }

      updated += 1
    }

    if (!options.dryRun) {
      const profiles = await syncEntityProfilesFromOpportunities(opportunities.slice(0, 12))
      syncedEntityProfiles.push(...profiles.map((profile) => profile.uei_sam))
    }

    await finishSamAlertRun(run.id, {
      status: 'completed',
      matched_count: updated,
      result_summary: {
        opportunitiesScored: updated,
        hotTasksCreated: hotTasks,
        convertedLeads,
        syncedEntityProfiles: syncedEntityProfiles.length,
      },
    })

    return {
      ok: true,
      opportunitiesScored: updated,
      hotTasksCreated: hotTasks,
      convertedLeads,
      syncedEntityProfiles: syncedEntityProfiles.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishSamAlertRun(run.id, {
      status: 'failed',
      error_message: message,
      result_summary: { error: message },
    })
    throw error
  }
}

export async function runSamExclusionRechecks(options: { dryRun?: boolean } = {}) {
  const run = await startSamAlertRun({
    run_type: 'exclusion_recheck',
    request_params: { dryRun: Boolean(options.dryRun) },
  })

  try {
    const watchlists = await ensureDefaultSamWatchlists()
    const checks = []

    for (const watchlist of watchlists.slice(0, envInt('SAM_EXCLUSION_CHECK_LIMIT', 8))) {
      const results = await searchSamExclusionsApi({
        exclusionName: watchlist.company_name || watchlist.label,
        classification: 'Firm',
        limit: 5,
      })

      if (!results.length) {
        checks.push({
          subject_type: 'watchlist' as const,
          subject_id: watchlist.id,
          subject_label: watchlist.label,
          legal_business_name: watchlist.company_name || watchlist.label,
          active_exclusion: false,
          match_status: 'no_match' as const,
          metadata_json: { watchlist: watchlist.label },
        })
        continue
      }

      for (const result of results) {
        checks.push({
          subject_type: 'watchlist' as const,
          subject_id: watchlist.id,
          subject_label: watchlist.label,
          uei_sam: result.ueiSAM || null,
          legal_business_name: result.exclusionName || watchlist.company_name || watchlist.label,
          exclusion_name: result.exclusionName || null,
          exclusion_type: result.exclusionType || null,
          classification: result.classification || null,
          exclusion_record_id: result.exclusionId || result.recordId || null,
          excluding_agency_name: result.excludingAgencyName || null,
          excluding_agency_code: result.excludingAgencyCode || null,
          active_exclusion: true,
          match_status: 'possible_match' as const,
          exclusion_url: result.exclusionURL || null,
          raw_json: result,
          metadata_json: { watchlist: watchlist.label },
        })
      }
    }

    const saved = options.dryRun ? checks : await insertSamExclusionChecks(checks as any)
    await finishSamAlertRun(run.id, {
      status: 'completed',
      matched_count: saved.length,
      result_summary: {
        checksRecorded: saved.length,
        activeMatches: saved.filter((row: any) => row.active_exclusion).length,
      },
    })

    return {
      ok: true,
      checksRecorded: saved.length,
      activeMatches: saved.filter((row: any) => row.active_exclusion).length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishSamAlertRun(run.id, {
      status: 'failed',
      error_message: message,
      result_summary: { error: message },
    })
    throw error
  }
}

export async function runSamAwardMonitor(options: { dryRun?: boolean } = {}) {
  const run = await startSamAlertRun({
    run_type: 'award_monitor',
    request_params: { dryRun: Boolean(options.dryRun) },
  })

  try {
    const watchlists = await ensureDefaultSamWatchlists()
    const postedTo = new Date().toISOString().slice(0, 10)
    const postedFrom = new Date(Date.now() - envInt('SAM_AWARD_DAYS_BACK', 30) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const awards = []

    for (const watchlist of watchlists.slice(0, envInt('SAM_AWARD_WATCHLIST_LIMIT', 5))) {
      const results = await searchSamOpportunitiesApi({
        keywords: watchlist.keywords,
        naicsCodes: watchlist.naics_codes,
        solicitationTypes: ['a'],
        state: watchlist.states?.[0],
        postedFrom,
        postedTo,
        limit: envInt('SAM_AWARD_PAGE_LIMIT', 20),
      })

      for (const row of results) {
        if (!row.award?.number && !row.award?.awardee?.name) continue
        awards.push({
          opportunity_id: null,
          dedupe_key: buildOpportunityDedupeKey(row),
          notice_id: row.noticeId || null,
          award_number: row.award?.number || null,
          awardee_name: row.award?.awardee?.name || null,
          awardee_uei_sam: row.award?.awardee?.ueiSAM || null,
          award_amount: row.award?.amount ? Number(row.award.amount) : null,
          award_date: row.award?.date || null,
          department_name: row.department || null,
          agency_name: row.subTier || null,
          office_name: row.office || null,
          naics_code: row.naicsCode || null,
          set_aside_code: row.typeOfSetAside || null,
          title: row.title || null,
          place_of_performance_json: row.placeOfPerformance || {},
          raw_json: row,
          tracked_competitor: Boolean(
            watchlist.company_name &&
              String(row.award?.awardee?.name || '').toLowerCase().includes(watchlist.company_name.toLowerCase())
          ),
          watchlist_match_count: 1,
        })
      }
    }

    const saved = options.dryRun ? awards : await upsertSamAwardIntelligence(awards as any)
    await finishSamAlertRun(run.id, {
      status: 'completed',
      matched_count: saved.length,
      result_summary: {
        awardsStored: saved.length,
        trackedCompetitorAwards: saved.filter((row: any) => row.tracked_competitor).length,
      },
    })

    return {
      ok: true,
      awardsStored: saved.length,
      trackedCompetitorAwards: saved.filter((row: any) => row.tracked_competitor).length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishSamAlertRun(run.id, {
      status: 'failed',
      error_message: message,
      result_summary: { error: message },
    })
    throw error
  }
}

export async function runSamAssistanceRefresh(options: { dryRun?: boolean } = {}) {
  const run = await startSamAlertRun({
    run_type: 'assistance_refresh',
    request_params: { dryRun: Boolean(options.dryRun) },
  })

  try {
    const watchlists = await ensureDefaultSamWatchlists()
    const rows = []

    for (const watchlist of watchlists.slice(0, envInt('SAM_ASSISTANCE_WATCHLIST_LIMIT', 4))) {
      const results = await searchSamAssistanceListingsApi({
        status: 'Active',
        organizationCodes: watchlist.organization_codes,
        organizationLevel: watchlist.organization_codes?.length ? 'Agency' : undefined,
        applicantTypes: watchlist.applicant_types,
        beneficiaryTypes: watchlist.beneficiary_types,
        assistanceTypes: watchlist.assistance_types,
        publishedDateFrom: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        pageSize: envInt('SAM_ASSISTANCE_PAGE_SIZE', 25),
      })

      for (const listing of results) {
        const haystack = JSON.stringify(listing).toLowerCase()
        if (
          watchlist.keywords.length &&
          !watchlist.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
        ) {
          continue
        }
        rows.push({
          assistance_listing_id: listing.assistanceListingId,
          title: listing.title || listing.popularLongName || 'Untitled listing',
          status: listing.status || null,
          agency_name: listing.federalOrganization?.agency || null,
          department_name: listing.federalOrganization?.department || null,
          office_name: listing.federalOrganization?.office || null,
          assistance_types: uniqueStrings((listing.assistanceTypes || []).map((item: any) => item.assistanceTypeCode || item.code)),
          applicant_types: uniqueStrings((listing.applicantTypes || []).map((item: any) => item.entityTypeCode || item.code)),
          beneficiary_types: uniqueStrings((listing.beneficiaryTypes || []).map((item: any) => item.entityTypeCode || item.code)),
          published_date: listing.publishedDate || null,
          program_url: listing.programWebPage || null,
          summary_text: listing.overview?.objective || listing.overview?.assistanceListingDescription || null,
          raw_json: listing,
        })
      }
    }

    const saved = options.dryRun ? rows : await upsertSamAssistanceListings(rows as any)
    await finishSamAlertRun(run.id, {
      status: 'completed',
      matched_count: saved.length,
      result_summary: {
        assistanceListingsStored: saved.length,
      },
    })

    return {
      ok: true,
      assistanceListingsStored: saved.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishSamAlertRun(run.id, {
      status: 'failed',
      error_message: message,
      result_summary: { error: message },
    })
    throw error
  }
}

function renderSamDigestHtml(summary: {
  hotOpportunities: SamOpportunityRecord[]
  exclusions: number
  awards: number
  assistance: number
}) {
  const rows = summary.hotOpportunities
    .slice(0, 6)
    .map(
      (item) =>
        `<li style="margin-bottom:8px;"><strong>${item.title}</strong> · ${item.agency_name || 'Unknown agency'} · ${item.response_deadline || 'No deadline'}</li>`
    )
    .join('')
  return `<div style="font-family:Arial,sans-serif;background:#081019;color:#eef6f8;padding:24px;"><h2 style="margin:0 0 12px;color:#fff;">VestBlock government intelligence report</h2><p>Hot opportunities: ${summary.hotOpportunities.length}</p><p>Active exclusion hits: ${summary.exclusions}</p><p>Tracked awards: ${summary.awards}</p><p>Assistance listings: ${summary.assistance}</p><ul>${rows}</ul></div>`
}

export async function runSamAlertDelivery(options: { dryRun?: boolean } = {}) {
  const run = await startSamAlertRun({
    run_type: 'alert_delivery',
    request_params: { dryRun: Boolean(options.dryRun) },
  })

  try {
    const dashboard = await getSamDashboardSummary()
    const exclusions = dashboard.exclusionChecks.filter((row) => row.active_exclusion).length
    const payload = {
      hotOpportunities: dashboard.hotOpportunities,
      exclusions,
      awards: dashboard.awards.length,
      assistance: dashboard.assistanceListings.length,
    }

    if (!options.dryRun && process.env.ADMIN_ALERT_EMAIL) {
      await sendEmail({
        to: process.env.ADMIN_ALERT_EMAIL,
        subject: `VestBlock government intelligence: ${dashboard.hotOpportunities[0]?.agency_name || 'daily summary'}`,
        html: renderSamDigestHtml(payload),
        eventType: 'admin_lead_run_daily_report',
      }).catch(() => null)
    }

    await finishSamAlertRun(run.id, {
      status: 'completed',
      sent_count: options.dryRun ? 0 : 1,
      matched_count: dashboard.hotOpportunities.length,
      result_summary: {
        hotOpportunities: dashboard.hotOpportunities.length,
        activeExclusions: exclusions,
        awards: dashboard.awards.length,
        assistanceListings: dashboard.assistanceListings.length,
      },
    })

    return {
      ok: true,
      hotOpportunities: dashboard.hotOpportunities.length,
      activeExclusions: exclusions,
      awards: dashboard.awards.length,
      assistanceListings: dashboard.assistanceListings.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishSamAlertRun(run.id, {
      status: 'failed',
      error_message: message,
      result_summary: { error: message },
    })
    throw error
  }
}

export async function runSamSmokeVerification() {
  const verification: Record<string, unknown> = {
    keyConfigured: Boolean(process.env.SAM_GOV_API_KEY),
    flagEnabled: envBool('LEADS_ENABLE_SAM', false),
  }

  try {
    const opportunities = await searchSamOpportunitiesApi({
      keywords: ['construction'],
      postedFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      postedTo: new Date().toISOString().slice(0, 10),
      limit: 1,
    })
    verification.opportunitiesEndpoint = {
      ok: true,
      count: opportunities.length,
    }
  } catch (error) {
    verification.opportunitiesEndpoint = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  try {
    const hierarchy = await searchFederalHierarchyApi({
      organizationName: 'GENERAL SERVICES ADMINISTRATION',
      limit: 1,
    })
    verification.federalHierarchyEndpoint = {
      ok: true,
      count: hierarchy.length,
    }
  } catch (error) {
    verification.federalHierarchyEndpoint = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  try {
    const runs = await listRecentSamAlertRuns(3)
    verification.recentRunsTracked = runs.length
  } catch (error) {
    verification.recentRunsTracked = `unavailable: ${error instanceof Error ? error.message : String(error)}`
  }

  return verification
}
