import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { recordStrategyDeliveryOutcome } from '@/lib/admin/strategyDelivery'
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
import {
  authorizeOperatingStrategyDispatch,
  reserveOperatingStrategyDispatch,
} from '@/lib/strategy/runtime-governance'

const GOVERNED_INVESTOR_NAMESPACE = 'legacy_runtime'
const GOVERNED_INVESTOR_SOURCE_IDENTIFIER = 'investor-network'

function getInvestorProviderReadiness() {
  const gmail = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
  )
  const resend = Boolean(process.env.RESEND_API_KEY)
  return {
    gmail,
    resend,
    defaultProvider: gmail ? 'gmail' : resend ? 'resend' : 'none',
  }
}

function configuredInvestorDispatchChannels(
  readiness: ReturnType<typeof getInvestorProviderReadiness>
) {
  if (readiness.resend) return { provider: 'resend' as const, channel: 'resend_email' }
  if (readiness.gmail) return { provider: 'gmail' as const, channel: 'gmail_email' }
  throw new Error('Investor dispatch requires a configured outbound email provider.')
}

async function authorizeInvestorEmailDispatch() {
  const readiness = getInvestorProviderReadiness()
  const adapter = configuredInvestorDispatchChannels(readiness)
  const binding = await authorizeOperatingStrategyDispatch({
    namespace: GOVERNED_INVESTOR_NAMESPACE,
    sourceIdentifier: GOVERNED_INVESTOR_SOURCE_IDENTIFIER,
    channel: adapter.channel,
    requestedExternalSends: 1,
    requiredDispatchAuthority: 'vestblock_application',
  })
  return { binding, adapter, readiness }
}

async function investorConsentSnapshot(investorId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('participant_profiles')
    .select('id,role,status,communication_preferences_json,outreach_consent,outreach_consent_at,consent_version,consent_recorded_at,operator_verified_at,legacy_claim_status')
    .eq('legacy_entity_type', 'investor_profiles')
    .eq('legacy_entity_id', investorId)
    .limit(2)
  if (error) throw error
  if ((data || []).length !== 1) {
    throw new Error('Investor dispatch requires exactly one operator-verified participant-profile link with first-class outreach consent.')
  }
  const profile = data![0]
  const preferences = (profile.communication_preferences_json || {}) as Record<string, unknown>
  if (
    profile.role !== 'investor' ||
    profile.status !== 'active' ||
    profile.legacy_claim_status !== 'verified' ||
    !profile.operator_verified_at ||
    profile.outreach_consent !== true ||
    !profile.outreach_consent_at ||
    preferences.email !== true
  ) {
    throw new Error('Investor dispatch is blocked until the linked active profile has verified ownership, email permission, and recorded outreach consent.')
  }
  return {
    basis: 'participant_profile_outreach_consent',
    dispatchAuthorized: true,
    evidenceKey: `participant-profile:${profile.id}:outreach-consent:${profile.outreach_consent_at}`,
    provenance: {
      sourceTable: 'participant_profiles',
      participantProfileId: profile.id,
      legacyEntityType: 'investor_profiles',
      legacyEntityId: investorId,
      consentVersion: profile.consent_version,
      consentRecordedAt: profile.consent_recorded_at,
      outreachConsentAt: profile.outreach_consent_at,
      operatorVerifiedAt: profile.operator_verified_at,
    },
  }
}

async function investorSuppressionSnapshot(investorId: string, email: string) {
  const admin = createAdminClient()
  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await admin
    .from('lead_suppressions')
    .select('id,reason')
    .eq('email', normalizedEmail)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (data?.id) throw new Error(`Investor recipient is suppressed: ${data.reason || 'active suppression'}.`)
  const checkedAt = new Date().toISOString()
  return {
    checkedAt,
    suppressionCleared: true,
    evidenceKey: `investor-suppression-preflight:${investorId}:${checkedAt}`,
    provenance: { sourceTable: 'lead_suppressions', matchField: 'email', subjectId: investorId },
    activeSuppression: false,
    usableEmail: true,
  }
}

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
    let authorization: Awaited<ReturnType<typeof authorizeInvestorEmailDispatch>> | null = null

    const requireAuthorization = async () => {
      if (!authorization) {
        authorization = await authorizeInvestorEmailDispatch()
      }
      return authorization
    }

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

      const { binding, adapter } = await requireAuthorization()
      if (investor.outreach_status === 'do_not_contact') {
        throw new Error('Investor dispatch is blocked because the investor is marked do not contact.')
      }
      if (
        investor.contact_email?.trim().toLowerCase() === 'contact@vestblock.io' &&
        process.env.ALLOW_CONTACT_ADMIN_ALERTS !== 'true'
      ) {
        throw new Error('Investor dispatch is blocked because routine automation notices cannot target contact@vestblock.io.')
      }
      const consentBasisSnapshot = await investorConsentSnapshot(investor.id)
      const suppressionSnapshot = await investorSuppressionSnapshot(investor.id, investor.contact_email!)
      const dispatchIntentAt = new Date().toISOString()
      const nextActionAt = adminTaskDueDates.days(4)
      const messageVersionKey = `${row.id}:approved:${row.approved_at || row.updated_at}`
      const reservation = await reserveOperatingStrategyDispatch({
        binding,
        channel: adapter.channel,
        requestedCount: 1,
        idempotencyKey: `investor-outreach:${binding.operatingStrategyVersionId}:${messageVersionKey}`,
      })
      const enrollmentBase = {
        strategyKey: binding.sourceIdentifier,
        channel: 'email' as const,
        messageId: row.id,
        recipient: investor.contact_email,
        market: investor.markets?.[0] || null,
        binding,
        governedStage: 'dispatch_intent' as const,
        subjectNamespace: 'investor_profile',
        subjectKey: investor.id,
        dispatchIntentAt,
        dispatchReservationId: reservation.reservationId,
        dispatchChannel: adapter.channel,
        provider: adapter.provider,
        outreachPurpose: 'legacy_investor_relationship_outreach',
        consentBasisSnapshot: {
          ...consentBasisSnapshot,
          messageStatus: row.status,
          approvedAt: row.approved_at,
          approvedByUserId: row.approved_by_user_id,
          capturedAt: dispatchIntentAt,
        },
        suppressionSnapshot: {
          ...suppressionSnapshot,
          replyCaptureReady: replyCapture.ready,
          deliveryCircuitAllowed: deliveryCircuitBreaker?.allowed === true,
        },
        messageVersionKey,
      }
      const dispatchIntent = await recordOutboundEnrollment({
        ...enrollmentBase,
        status: 'queued',
        nextActionAt,
        metadata: {
          investorId: investor.id,
          investorType: investor.primary_investor_type,
          authorizedChannels: [adapter.channel],
        },
      })

      const sent = await sendInvestorOutreachEmail({
        investor,
        message: row,
        provider: adapter.provider,
        disableFallback: true,
      })
      if (!sent.ok) {
        const failedAt = new Date().toISOString()
        await recordOutboundEnrollment({
          ...enrollmentBase,
          enrollmentId: dispatchIntent.id,
          status: 'failed',
          provider: sent.provider,
          suppressionReason: sent.error || 'send_failed',
          nextActionAt: null,
          metadata: {
            investorId: investor.id,
            investorType: investor.primary_investor_type,
            authorizedChannels: [adapter.channel],
            error: sent.error || 'send_failed',
            providerResultAt: failedAt,
          },
        })
        const failedDeliveryOutcome = await recordStrategyDeliveryOutcome({
          subjectNamespace: 'investor_profile',
          subjectKey: investor.id,
          messageId: row.id,
          enrollmentId: dispatchIntent.id,
          operatingStrategyVersionId: binding.operatingStrategyVersionId,
          provider: sent.provider,
          providerMessageId: sent.providerMessageId || null,
          evidenceId: `investor-outreach:${row.id}:${sent.provider}:failed`,
          status: 'failed',
          occurredAt: failedAt,
        })
        if (!failedDeliveryOutcome.updated) {
          throw new Error(`Investor delivery outcome attribution failed: ${failedDeliveryOutcome.reason}.`)
        }
        await updateInvestorOutreachMessage(row.id, {
          status: 'failed',
          send_provider: sent.provider,
          send_error: sent.error || 'Send failed.',
          metadata_json: {
            ...(row.metadata_json || {}),
            providerResultAt: failedAt,
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
          metadata: { reason: sent.error || 'send_failed', messageId: row.id, provider: sent.provider, providerResultAt: failedAt },
        }).catch(() => null)
        results.push({ investorId: investor.id, name: investor.display_name, status: 'failed' })
        continue
      }

      const acceptedAt = new Date().toISOString()
      await recordOutboundEnrollment({
        ...enrollmentBase,
        enrollmentId: dispatchIntent.id,
        status: 'accepted',
        provider: sent.provider,
        providerMessageId: sent.providerMessageId || null,
        nextActionAt,
        metadata: {
          investorId: investor.id,
          investorType: investor.primary_investor_type,
          authorizedChannels: [adapter.channel],
          providerResultAt: acceptedAt,
        },
      })
      const acceptedDeliveryOutcome = await recordStrategyDeliveryOutcome({
        subjectNamespace: 'investor_profile',
        subjectKey: investor.id,
        messageId: row.id,
        enrollmentId: dispatchIntent.id,
        operatingStrategyVersionId: binding.operatingStrategyVersionId,
        provider: sent.provider,
        providerMessageId: sent.providerMessageId || null,
        evidenceId: `investor-outreach:${row.id}:${sent.provider}:${sent.providerMessageId || 'accepted'}`,
        status: 'accepted',
        occurredAt: acceptedAt,
      })
      if (!acceptedDeliveryOutcome.updated) {
        throw new Error(`Investor delivery outcome attribution failed: ${acceptedDeliveryOutcome.reason}.`)
      }
      await updateInvestorOutreachMessage(row.id, {
        status: 'sent',
        sent_at: acceptedAt,
        send_provider: sent.provider,
        send_error: null,
        metadata_json: {
          ...(row.metadata_json || {}),
          providerMessageId: sent.providerMessageId || null,
          providerAcceptedAt: acceptedAt,
        },
      })
      await updateInvestorRecord(investor.id, {
        relationship_stage: 'contacted',
        outreach_status: 'sent',
        last_contacted_at: acceptedAt,
        next_follow_up_at: nextActionAt,
      })
      await insertInvestorEngagementEvent({
        investorId: investor.id,
        outreachMessageId: row.id,
        eventType: 'note',
        eventValue: 'outreach_sent',
        metadata: { provider: sent.provider, sequenceCode: row.sequence_code, providerResultAt: acceptedAt },
      })
      await logEvent({
        eventType: 'admin_action',
        entityType: 'investor_profile',
        entityId: investor.id,
        metadata: { action: 'investor_outreach_sent', messageId: row.id, provider: sent.provider, providerResultAt: acceptedAt },
      })
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
