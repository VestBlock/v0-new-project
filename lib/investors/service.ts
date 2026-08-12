import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { discoverInvestorsForMarket } from '@/lib/investors/discovery'
import { sendInvestorOutreachEmail } from '@/lib/investors/outbound'
import { scoreExistingInvestor } from '@/lib/investors/scoring'
import {
  finishInvestorAutomationRun,
  generateInvestorFollowup,
  generateInvestorOutreach,
  insertInvestorEngagementEvent,
  listApprovedInvestorEmailOutreach,
  listInvestorOutreachForAutoApproval,
  listInvestorsForScoring,
  listInvestorsNeedingFollowup,
  listInvestorsNeedingOutreach,
  startInvestorAutomationRun,
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
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import { evaluateInvestorAutoApproval } from '@/lib/investors/automationCore'
import { INVESTOR_OUTREACH_TEMPLATE_VERSION } from '@/lib/investors/outreach'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
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
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
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

export async function runDailyInvestorSend(limit = 20, options: { dryRun?: boolean } = {}) {
  const autoSendRequested = ['1', 'true', 'yes', 'on'].includes(String(process.env.INVESTOR_AUTO_SEND_ENABLED || '').toLowerCase())
  const deliveryCircuitBreaker = autoSendRequested ? await getDeliveryCircuitBreaker() : null
  const replyCapture = getReplyCaptureReadiness()
  const autoSend = autoSendRequested && deliveryCircuitBreaker?.allowed === true && replyCapture.ready
  const run = await startInvestorAutomationRun({
    runType: 'outreach_send',
    sourceKey: 'investor_outreach_messages',
    requestParams: { limit, dryRun: options.dryRun || false, autoSend },
  })

  try {
    const approved = await listApprovedInvestorEmailOutreach(limit)
    const results: Array<{ investorId: string; name: string; status: string }> = []

    for (const row of approved) {
      const investor = row.investor_profiles as InvestorProfileRecord | null
      if (!investor?.id) continue

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

      const sent = await sendInvestorOutreachEmail({ investor, message: row })
      if (!sent.ok) {
        await updateInvestorOutreachMessage(row.id, {
          status: 'failed',
          send_provider: sent.provider,
          send_error: sent.error || 'Send failed.',
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
        continue
      }

      const now = new Date().toISOString()
      await updateInvestorOutreachMessage(row.id, {
        status: 'sent',
        sent_at: now,
        send_provider: sent.provider,
        send_error: null,
        metadata_json: {
          ...(row.metadata_json || {}),
          providerMessageId: sent.providerMessageId || null,
          providerAcceptedAt: now,
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
        },
      }).catch(() => null)
      results.push({ investorId: investor.id, name: investor.display_name, status: 'accepted' })
    }

    await finishInvestorAutomationRun(run.id, { status: 'completed', resultCount: results.length })
    return { ok: true, count: results.length, results, autoSendEnabled: autoSend, autoSendRequested, deliveryCircuitBreaker, replyCapture }
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
