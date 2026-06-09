import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { discoverInvestorsForMarket } from '@/lib/investors/discovery'
import { sendInvestorOutreachEmail } from '@/lib/investors/outbound'
import { scoreExistingInvestor } from '@/lib/investors/scoring'
import {
  finishInvestorAutomationRun,
  generateInvestorOutreach,
  insertInvestorEngagementEvent,
  listApprovedInvestorEmailOutreach,
  listInvestorsForScoring,
  listInvestorsNeedingFollowup,
  listInvestorsNeedingOutreach,
  startInvestorAutomationRun,
  updateInvestorOutreachMessage,
  updateInvestorRecord,
  upsertInvestorProfile,
} from '@/lib/investors/repository'
import type { InvestorProfileRecord } from '@/lib/investors/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { logEvent } from '@/lib/system/logEvent'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'

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
  const autoSend = ['1', 'true', 'yes', 'on'].includes(String(process.env.INVESTOR_AUTO_SEND_ENABLED || '').toLowerCase())
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
      results.push({ investorId: investor.id, name: investor.display_name, status: 'sent' })
    }

    await finishInvestorAutomationRun(run.id, { status: 'completed', resultCount: results.length })
    return { ok: true, count: results.length, results, autoSendEnabled: autoSend }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyInvestorFollowup(limit = 30) {
  const run = await startInvestorAutomationRun({
    runType: 'followup',
    sourceKey: 'investor_profiles',
    requestParams: { limit },
  })

  try {
    const investors = await listInvestorsNeedingFollowup(limit)
    const results: Array<{ investorId: string; name: string; action: string }> = []
    for (const investor of investors) {
      await createAdminTask({
        title: `Investor follow-up: ${investor.display_name}`,
        description:
          'Review investor relationship status and collect missing buy box, lending needs, disposition needs, deal submissions, or capital partner fit.',
        taskType: 'investor_relationship_followup',
        assignedTo: investor.owner_user_id || null,
        priority: investor.relationship_stage === 'responded' ? 'high' : 'normal',
        entityType: 'investor_profile',
        entityId: investor.id,
        dueAt: adminTaskDueDates.now(),
        metadata: {
          investorId: investor.id,
          sequence: investor.assigned_sequence,
          relationshipStage: investor.relationship_stage,
        },
      }).catch(() => null)

      await updateInvestorRecord(investor.id, {
        relationship_stage: investor.relationship_stage === 'responded' ? 'followup_due' : investor.relationship_stage,
        outreach_status: investor.outreach_status === 'sent' ? 'followup_due' : investor.outreach_status,
        next_follow_up_at: adminTaskDueDates.days(5),
      })
      results.push({ investorId: investor.id, name: investor.display_name, action: 'followup_queued' })
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
