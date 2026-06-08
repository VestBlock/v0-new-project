import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { queueSeoForLenderRecord } from '@/lib/content/entitySeoExpansion'
import { enrichContactFromHunter } from '@/lib/email/hunter'
import { discoverLendersForMarket } from '@/lib/lenders/discovery'
import { matchBorrowerToLenders } from '@/lib/lenders/matching'
import { generateLenderOutreach } from '@/lib/lenders/outreach'
import {
  addLenderNote,
  finishLenderOutreachRun,
  insertLenderRelationshipEvent,
  listApprovedLenderEmailOutreach,
  listLendersForScoring,
  listLendersNeedingFollowup,
  listLendersNeedingOutreach,
  saveLenderOutreachMessages,
  saveLenderScore,
  startLenderOutreachRun,
  updateLenderPerformance,
  updateLenderRecord,
  upsertLender,
  upsertLenderMatch,
} from '@/lib/lenders/repository'
import { scoreLender } from '@/lib/lenders/scoring'
import { analyzeLenderWebsite } from '@/lib/lenders/site-analysis'
import type { BorrowerMatchInput, LenderRecord } from '@/lib/lenders/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'

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
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function enrichAndScoreLender(lender: LenderRecord) {
  const siteAnalysis = await analyzeLenderWebsite(lender.website)
  const hunterResult =
    lender.contact_email || !lender.website
      ? null
      : await enrichContactFromHunter({
          website: lender.website,
          contactName: lender.contact_name || null,
        })

  const updated = await updateLenderRecord(lender.id, {
    contact_email: lender.contact_email || siteAnalysis.contactEmail || hunterResult?.primaryCandidate?.email || null,
    contact_phone: lender.contact_phone || siteAnalysis.contactPhone || null,
    contact_name: lender.contact_name || hunterResult?.primaryCandidate?.fullName || null,
    startup_allowed: lender.startup_allowed || siteAnalysis.startupAllowed,
    investor_allowed: lender.investor_allowed || siteAnalysis.investorAllowed,
    owner_occupied_allowed: lender.owner_occupied_allowed || siteAnalysis.ownerOccupiedAllowed,
    bilingual_support: lender.bilingual_support || siteAnalysis.bilingualSupport,
    spanish_support: lender.spanish_support || siteAnalysis.spanishSupport,
    low_doc: lender.low_doc || siteAnalysis.lowDoc,
    cash_out_allowed: lender.cash_out_allowed || siteAnalysis.cashOutAllowed,
    first_time_investor_allowed: lender.first_time_investor_allowed || siteAnalysis.firstTimeInvestorAllowed,
    loan_amount_min: lender.loan_amount_min ?? siteAnalysis.loanAmountMin ?? null,
    loan_amount_max: lender.loan_amount_max ?? siteAnalysis.loanAmountMax ?? null,
    fit_summary: lender.fit_summary || siteAnalysis.summary,
    metadata_json: {
      ...(lender.metadata_json || {}),
      lenderSiteAnalysis: siteAnalysis,
      hunterContactEnrichment: hunterResult
        ? {
            status: hunterResult.status,
            domain: hunterResult.domain,
            note: hunterResult.note,
            checkedAt: new Date().toISOString(),
            primaryCandidate: hunterResult.primaryCandidate,
            candidates: hunterResult.candidates.slice(0, 5),
          }
        : (lender.metadata_json?.hunterContactEnrichment as Record<string, unknown> | undefined),
    },
  })

  const score = scoreLender(updated)
  const scored = await saveLenderScore(updated.id, score, updated.metadata_json || {})
  await logEvent({
    eventType: 'lender_scored',
    entityType: 'lender',
    entityId: updated.id,
    metadata: { confidenceScore: score.confidenceScore, category: updated.category },
  })
  return scored
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
  const lenders = await listLendersForScoring(limit)
  const results: Array<{ lenderId: string; name: string; confidenceScore: number }> = []
  for (const lender of lenders) {
    const scored = await enrichAndScoreLender(lender)
    results.push({
      lenderId: scored.id,
      name: scored.name,
      confidenceScore: scored.confidence_score,
    })
  }
  return { ok: true, count: results.length, results }
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

export async function runDailyLenderFollowup(limit = 30) {
  const lenders = await listLendersNeedingFollowup(limit)
  const results: Array<{ lenderId: string; name: string; action: string }> = []
  for (const lender of lenders) {
    await createAdminTask({
      title: `Lender follow-up: ${lender.name}`,
      description: `Review lender relationship stage ${lender.relationship_stage} and determine the right next partner step.`,
      taskType: 'lender_relationship_followup',
      assignedTo: lender.owner_user_id || null,
      priority: lender.relationship_stage === 'responded' ? 'high' : 'normal',
      entityType: 'lender',
      entityId: lender.id,
      dueAt: adminTaskDueDates.now(),
      metadata: {
        lenderId: lender.id,
        lenderCategory: lender.category,
        relationshipStage: lender.relationship_stage,
      },
    }).catch(() => null)

    await updateLenderRecord(lender.id, {
      relationship_stage: lender.relationship_stage === 'responded' ? 'reviewing' : lender.relationship_stage,
      outreach_status: lender.outreach_status === 'followup_due' ? 'needs_review' : lender.outreach_status,
      next_follow_up_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    })
    results.push({ lenderId: lender.id, name: lender.name, action: 'followup_queued' })
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
