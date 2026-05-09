import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { queueSeoForBuyerRecord } from '@/lib/content/entitySeoExpansion'
import { enrichContactFromHunter } from '@/lib/email/hunter'
import { discoverBuyersForMarket } from '@/lib/buyers/discovery'
import { matchPropertyToBuyers } from '@/lib/buyers/matching'
import { generateBuyerOutreach } from '@/lib/buyers/outreach'
import {
  addBuyerNote,
  finishBuyerOutreachRun,
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
  upsertBuyer,
  upsertBuyerMatch,
} from '@/lib/buyers/repository'
import { scoreBuyer } from '@/lib/buyers/scoring'
import { analyzeBuyerWebsite } from '@/lib/buyers/site-analysis'
import type { BuyerBuyBoxRecord, BuyerRecord, PropertyBuyerMatchInput } from '@/lib/buyers/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'

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
    const raw = await discoverBuyersForMarket({
      city: input.city,
      state: input.state,
      metroArea: input.metroArea,
      niches: input.niches,
      limitPerNiche: input.limitPerNiche,
      provider: 'google',
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

export async function enrichAndScoreBuyer(buyer: BuyerRecord) {
  const analysis = await analyzeBuyerWebsite(buyer.website)
  const hunterResult =
    buyer.contact_email || !buyer.website
      ? null
      : await enrichContactFromHunter({
          website: buyer.website,
          contactName: buyer.contact_name || null,
        })

  const updated = await updateBuyerRecord(buyer.id, {
    contact_email: buyer.contact_email || analysis.contactEmail || hunterResult?.primaryCandidate?.email || null,
    contact_phone: buyer.contact_phone || analysis.contactPhone || null,
    contact_name: buyer.contact_name || hunterResult?.primaryCandidate?.fullName || null,
    bilingual_support: buyer.bilingual_support || analysis.bilingualSupport,
    spanish_support: buyer.spanish_support || analysis.spanishSupport,
    closing_speed: buyer.closing_speed || analysis.closingSpeed || null,
    proof_of_funds_status: buyer.proof_of_funds_status || analysis.proofOfFundsSignal || null,
    fit_summary: buyer.fit_summary || analysis.summary,
    metadata_json: {
      ...(buyer.metadata_json || {}),
      buyerSiteAnalysis: analysis,
      hunterContactEnrichment: hunterResult
        ? {
            status: hunterResult.status,
            domain: hunterResult.domain,
            note: hunterResult.note,
            checkedAt: new Date().toISOString(),
            primaryCandidate: hunterResult.primaryCandidate,
            candidates: hunterResult.candidates.slice(0, 5),
          }
        : (buyer.metadata_json?.hunterContactEnrichment as Record<string, unknown> | undefined),
    },
  })

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
  for (const buyer of buyers) {
    const scored = await enrichAndScoreBuyer(buyer)
    results.push({ buyerId: scored.id, name: scored.name, confidenceScore: scored.confidence_score })
  }
  return { ok: true, count: results.length, results }
}

export async function runDailyBuyerOutreach(limit = 40) {
  const buyers = await listBuyersNeedingOutreach(limit)
  const results: Array<{ buyerId: string; name: string; messageCount: number }> = []
  for (const buyer of buyers) {
    const messages = await generateAndStoreBuyerOutreach(buyer)
    results.push({ buyerId: buyer.id, name: buyer.name, messageCount: messages.length })
  }
  return { ok: true, count: results.length, results }
}

export async function runDailyBuyerFollowup(limit = 30) {
  const buyers = await listBuyersNeedingFollowup(limit)
  const results: Array<{ buyerId: string; name: string; action: string }> = []
  for (const buyer of buyers) {
    await createAdminTask({
      title: `Buyer follow-up: ${buyer.name}`,
      description: `Review buyer relationship stage ${buyer.relationship_stage} and confirm the current acquisition box or submission path.`,
      taskType: 'buyer_relationship_followup',
      assignedTo: buyer.owner_user_id || null,
      priority: buyer.relationship_stage === 'responded' ? 'high' : 'normal',
      entityType: 'buyer',
      entityId: buyer.id,
      dueAt: adminTaskDueDates.now(),
      metadata: {
        buyerId: buyer.id,
        buyerCategory: buyer.category,
        relationshipStage: buyer.relationship_stage,
      },
    }).catch(() => null)

    await updateBuyerRecord(buyer.id, {
      relationship_stage: buyer.relationship_stage === 'responded' ? 'reviewing' : buyer.relationship_stage,
      outreach_status: buyer.outreach_status === 'followup_due' ? 'needs_review' : buyer.outreach_status,
      next_follow_up_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    results.push({ buyerId: buyer.id, name: buyer.name, action: 'followup_queued' })
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
