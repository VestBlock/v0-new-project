import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { sendEmail } from '@/lib/email/sendEmail'
import { DEFAULT_LENDER_DISCOVERY_MARKETS, DEFAULT_LENDER_DISCOVERY_NICHES } from '@/lib/lenders/constants'
import { listMarketsForExpansionLane, pickDiscoveryTermsForMarket } from '@/lib/leads/marketExpansion'
import { getDeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import { sendLenderOutreachEmail } from '@/lib/lenders/outbound'
import {
  claimLenderOutreachMessageForSend,
  downgradeLenderOutreachMessageIfApproved,
  finishLenderOutreachRun,
  listApprovedLenderEmailOutreach,
  listLenderOutreachForAutoApproval,
  listVerifiedLenderCanaryOutreach,
  restoreLenderOutreachMessageAfterQuotaDenial,
  updateLenderOutreachMessage,
  updateLenderPerformance,
  updateLenderRecord,
} from '@/lib/lenders/repository'
import {
  discoverAndIngestLendersForMarket,
  generateAndStoreLenderOutreach,
  runDailyLenderFollowup,
  runDailyLenderOutreach,
  runDailyLenderPerformanceRollup,
  runDailyLenderScoring,
} from '@/lib/lenders/service'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { evaluateLenderAutoApproval } from '@/lib/lenders/automationCore'
import { LENDER_OUTREACH_TEMPLATE_VERSION } from '@/lib/lenders/outreach'
import { startLenderOutreachRun } from '@/lib/lenders/repository'
import type { LenderOutreachMessageRecord, LenderRecord } from '@/lib/lenders/types'
import { logEvent } from '@/lib/system/logEvent'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCommercialOutreachMailingAddress } from '@/lib/outreach/commercialCompliance'
import { deliveryBreakerAllowsLenderCanary, evaluateLenderRecoveryCanaryReadiness } from '@/lib/lenders/canary'
import { getConfiguredOutboundProvider } from '@/lib/outreach/provider-preference'
import { getOutreachRecipientGuard } from '@/lib/outreach/suppression'
import { reserveAutomaticEmailLaneAttempt } from '@/lib/outreach/laneAttemptQuota'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function buildDigestHtml(title: string, items: string[]) {
  const rows = items.map((item) => `<li style="margin-bottom:8px;">${item}</li>`).join('')
  return `<div style="font-family:Arial,sans-serif;background:#081019;color:#eef6f8;padding:24px;"><h2 style="color:#fff;">${title}</h2><ul>${rows}</ul></div>`
}

async function sendAdminDigest(subject: string, title: string, items: string[]) {
  if (!process.env.ADMIN_ALERT_EMAIL || items.length === 0) return
  await sendEmail({
    to: process.env.ADMIN_ALERT_EMAIL,
    subject,
    html: buildDigestHtml(title, items),
    eventType: 'admin_lead_followup',
  }).catch(() => null)
}

export async function runDailyLenderDiscovery(options: { dryRun?: boolean } = {}) {
  const run = await startLenderOutreachRun({
    runType: 'daily_discovery',
    sourceKey: 'google_places_lenders',
    requestParams: { dryRun: options.dryRun || false },
  })

  try {
    const marketLimit = envInt('LENDERS_DAILY_MARKET_COUNT', 4)
    const results: Array<{ market: string; count: number }> = []
    const evolvingMarkets = await listMarketsForExpansionLane('lenders', { limit: marketLimit }).catch(() => [])
    const markets = evolvingMarkets.length
      ? evolvingMarkets.map((market) => ({
          city: market.city,
          state: market.state,
          metroArea: market.metro_area,
          niches: pickDiscoveryTermsForMarket(market, 'lenders', new Date(), envInt('LENDERS_DAILY_NICHE_COUNT', 4)),
        }))
      : DEFAULT_LENDER_DISCOVERY_MARKETS.slice(0, marketLimit).map((market) => ({
          ...market,
          niches: [...DEFAULT_LENDER_DISCOVERY_NICHES.slice(0, envInt('LENDERS_DAILY_NICHE_COUNT', 4))],
        }))
    for (const market of markets) {
      const lenders = options.dryRun
        ? []
        : await discoverAndIngestLendersForMarket({
            city: market.city,
            state: market.state,
            metroArea: market.metroArea,
            niches: market.niches,
            limitPerNiche: envInt('LENDERS_DAILY_LIMIT_PER_NICHE', 3),
          })
      results.push({ market: `${market.city}, ${market.state}`, count: lenders.length })
    }

    await finishLenderOutreachRun(run.id, {
      status: 'completed',
      resultCount: results.reduce((sum, item) => sum + item.count, 0),
    })

    if (!options.dryRun) {
      await sendAdminDigest(
        'VestBlock lender discovery report',
        'Lender discovery summary',
        results.map((item) => `${item.market}: ${item.count} lender prospects`)
      )
    }

    return { ok: true, count: results.reduce((sum, item) => sum + item.count, 0), results }
  } catch (error) {
    await finishLenderOutreachRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyLenderSend(
  limit = 15,
  options: { dryRun?: boolean; canary?: boolean; recoveryExplicitlyRequested?: boolean } = {}
) {
  const canary = Boolean(options.canary)
  const canaryEnabled = envBool('OUTREACH_CANARY_ENABLED', false)
  const lenderAutoSendEnabled = envBool('LENDER_AUTO_SEND_ENABLED', false)
  const dailyLimit = envInt('LENDERS_DAILY_SEND_LIMIT', 15)
  const laneAttemptLimit = canary ? Math.min(5, dailyLimit) : dailyLimit
  const autoSendRequested = lenderAutoSendEnabled && (!canary || canaryEnabled)
  const deliveryCircuitBreaker = autoSendRequested || canary
    ? await getDeliveryCircuitBreaker({
        provider: getConfiguredOutboundProvider(),
        allowRecoveryCanary: canary,
      })
    : null
  const replyCapture = getReplyCaptureReadiness()
  const mailingAddressConfigured = Boolean(getCommercialOutreachMailingAddress())
  const deliveryGateOpen = canary
    ? deliveryBreakerAllowsLenderCanary({
        mode: deliveryCircuitBreaker?.mode,
        recoveryCanaryAllowed: deliveryCircuitBreaker?.recoveryCanaryAllowed === true,
      })
    : deliveryCircuitBreaker?.broadSendingAllowed === true
  const replyCaptureGateOpen = replyCapture.ready && (!canary || replyCapture.configured)
  let effectiveLimit = canary
    ? Math.min(5, limit)
    : Math.min(limit, deliveryCircuitBreaker?.maxBatchSize || Number.POSITIVE_INFINITY)
  let canarySentLast24h = 0
  if (canary) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error } = await createAdminClient()
      .from('lender_outreach_messages')
      .select('id', { count: 'exact', head: true })
      .contains('metadata_json', { canary: true })
      .not('sent_at', 'is', null)
      .gte('sent_at', since)
    if (error) throw error
    canarySentLast24h = count || 0
    effectiveLimit = Math.max(0, Math.min(effectiveLimit, 5 - canarySentLast24h))
  }
  const approved = effectiveLimit > 0
    ? canary
      ? await listVerifiedLenderCanaryOutreach(effectiveLimit)
      : await listApprovedLenderEmailOutreach(effectiveLimit)
    : []
  const verifiedCandidateGateOpen = !canary || approved.length > 0
  const canaryReadiness = canary
    ? evaluateLenderRecoveryCanaryReadiness({
        explicitlyRequested: options.recoveryExplicitlyRequested === true,
        featureEnabled: canaryEnabled,
        lenderAutoSendEnabled,
        deliveryCanaryPermitted: deliveryGateOpen,
        replyCaptureConfigured: replyCaptureGateOpen,
        mailingAddressConfigured,
        eligibleCandidateCount: approved.length,
        remainingCapacity: effectiveLimit,
      })
    : null
  const sendGateOpen = canary
    ? canaryReadiness?.allowed === true
    : autoSendRequested && deliveryGateOpen && replyCaptureGateOpen && mailingAddressConfigured && verifiedCandidateGateOpen
  const autoSend = sendGateOpen && !options.dryRun
  const sendBlockedReasons = canary
    ? canaryReadiness?.blockedReasons || []
    : [
        !autoSendRequested ? 'lender_auto_send_disabled' : null,
        !deliveryGateOpen ? 'broad_delivery_not_permitted' : null,
        !replyCaptureGateOpen ? 'reply_capture_not_configured' : null,
        !mailingAddressConfigured ? 'mailing_address_not_configured' : null,
      ].filter((reason): reason is string => Boolean(reason))
  const results: Array<{ lenderId: string; name: string; status: string }> = []

  for (const row of approved) {
    const lender = row.lenders as LenderRecord | null
    if (!lender?.id) continue

    const approvalDecision = evaluateLenderAutoApproval({
      lender,
      message: row as LenderOutreachMessageRecord,
      templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
      minimumScore: envInt('LENDER_AUTO_APPROVE_MIN_SCORE', 40),
      allowedChannels: ['email_intro', 'email_followup', 'spanish_email'],
    })
    if (!approvalDecision.approved) {
      if (!options.dryRun) {
        const downgraded = await downgradeLenderOutreachMessageIfApproved(row.id, {
          send_error: `approval_revalidation:${approvalDecision.reason}`,
        })
        if (!downgraded) {
          results.push({ lenderId: lender.id, name: lender.name, status: 'message_state_changed' })
          continue
        }
      }
      results.push({ lenderId: lender.id, name: lender.name, status: `approval_revalidation_blocked:${approvalDecision.reason}` })
      continue
    }

    if (!sendGateOpen) {
      results.push({ lenderId: lender.id, name: lender.name, status: canary ? 'canary_blocked' : 'queued_for_review' })
      continue
    }

    if (!isUsableContactEmail(lender.contact_email)) {
      if (!options.dryRun) {
        await createAdminTask({
          title: `Lender autopilot blocked: ${lender.name}`,
          description:
            'Approved lender outreach could not send because there is no usable contact email. Enrich the contact record or route a different channel.',
          taskType: 'lender_autopilot_blocked',
          priority: 'high',
          entityType: 'lender',
          entityId: lender.id,
          dueAt: adminTaskDueDates.now(),
          metadata: { reason: 'invalid_email', messageId: row.id, channel: row.channel },
        }).catch(() => null)
      }
      results.push({ lenderId: lender.id, name: lender.name, status: 'invalid_email' })
      continue
    }

    if (!autoSend) {
      results.push({ lenderId: lender.id, name: lender.name, status: 'would_send' })
      continue
    }

    const finalRecipientGuard = await getOutreachRecipientGuard({
      scope: 'lender',
      entityId: lender.id,
      email: lender.contact_email,
    })
    if (!finalRecipientGuard.allowed) {
      results.push({ lenderId: lender.id, name: lender.name, status: 'suppression_blocked' })
      continue
    }

    const claimed = await claimLenderOutreachMessageForSend(row.id, row.updated_at)
    if (!claimed) {
      results.push({ lenderId: lender.id, name: lender.name, status: 'duplicate_claim_blocked' })
      continue
    }

    let laneAttemptReservation
    try {
      laneAttemptReservation = await reserveAutomaticEmailLaneAttempt({
        lane: 'lender',
        messageId: claimed.id,
        claimId: `${claimed.id}:${claimed.updated_at}`,
        dailyLimit: laneAttemptLimit,
      })
    } catch {
      const restored = await restoreLenderOutreachMessageAfterQuotaDenial(
        claimed.id,
        claimed.updated_at
      ).catch(() => null)
      results.push({
        lenderId: lender.id,
        name: lender.name,
        status: restored
          ? 'automatic_email_attempt_quota_unavailable'
          : 'automatic_email_attempt_quota_restore_failed',
      })
      break
    }
    if (!laneAttemptReservation.allowed) {
      const restored = await restoreLenderOutreachMessageAfterQuotaDenial(
        claimed.id,
        claimed.updated_at
      ).catch(() => null)
      results.push({
        lenderId: lender.id,
        name: lender.name,
        status: restored
          ? laneAttemptReservation.reason || 'automatic_email_attempt_quota_denied'
          : 'automatic_email_attempt_quota_restore_failed',
      })
      break
    }

    const sent = await sendLenderOutreachEmail({
      lender,
      message: claimed,
      deliveryMode: canary ? 'recovery_canary' : 'standard',
    })
    if (!sent.ok) {
      await updateLenderOutreachMessage(row.id, {
        status: 'failed',
        send_provider: sent.provider,
        send_error: sent.error || 'Send failed.',
        metadata_json: {
          ...(claimed.metadata_json || {}),
          idempotencyKey: sent.idempotencyKey || null,
          correlationId: sent.correlationId || null,
          canary,
        },
      })
      await updateLenderRecord(lender.id, { outreach_status: 'failed' })
      await createAdminTask({
        title: `Lender autopilot send failed: ${lender.name}`,
        description:
          'Approved lender outreach failed during auto-send. Review provider status, recipient quality, and whether the message should be retried manually.',
        taskType: 'lender_autopilot_send_failed',
        priority: 'urgent',
        entityType: 'lender',
        entityId: lender.id,
        dueAt: adminTaskDueDates.now(),
        metadata: { reason: sent.error || 'send_failed', messageId: row.id, provider: sent.provider },
      }).catch(() => null)
      results.push({ lenderId: lender.id, name: lender.name, status: 'failed' })
      continue
    }

    await updateLenderOutreachMessage(row.id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_provider: sent.provider,
      send_error: null,
      metadata_json: {
        ...(claimed.metadata_json || {}),
        providerMessageId: sent.providerMessageId || null,
        providerAcceptedAt: new Date().toISOString(),
        idempotencyKey: sent.idempotencyKey || null,
        correlationId: sent.correlationId || null,
        canary,
      },
    })
    await updateLenderRecord(lender.id, {
      relationship_stage: 'contacted',
      outreach_status: 'sent',
      last_contacted_at: new Date().toISOString(),
      next_follow_up_at: adminTaskDueDates.days(4),
    })
    await updateLenderPerformance(lender.id, {
      outreach_sent_count: ((lender.metadata_json?.outreachSentCount as number) || 0) + 1,
      last_contacted_at: new Date().toISOString(),
    })
    await logEvent({
      eventType: 'lender_outreach_sent',
      entityType: 'lender',
      entityId: lender.id,
      metadata: { messageId: row.id, provider: sent.provider },
    })
    await recordOutboundEnrollment({
      strategyKey: 'lender-network',
      channel: 'email',
      status: 'accepted',
      messageId: row.id,
      recipient: lender.contact_email,
      market: [lender.headquarters_city, lender.headquarters_state].filter(Boolean).join(', '),
      nextActionAt: adminTaskDueDates.days(4),
      metadata: {
        lenderId: lender.id,
        lenderCategory: lender.category,
        provider: sent.provider,
        providerMessageId: sent.providerMessageId || null,
        idempotencyKey: sent.idempotencyKey || null,
        correlationId: sent.correlationId || null,
        canary,
      },
    }).catch(() => null)
    results.push({ lenderId: lender.id, name: lender.name, status: 'accepted' })
  }

  const operationalFailureCount = results.filter((result) =>
    result.status === 'failed' ||
    (result.status.startsWith('automatic_email_') && result.status !== 'automatic_email_daily_attempt_quota_exhausted')
  ).length

  return {
    ok: operationalFailureCount === 0,
    operationalFailureCount,
    count: results.length,
    results,
    canary,
    canaryEnabled,
    canarySentLast24h,
    dailyLimit,
    laneAttemptLimit,
    eligibleVerifiedCandidates: canary ? approved.length : null,
    effectiveLimit,
    autoSendEnabled: autoSend,
    autoSendRequested,
    sendGateOpen,
    sendBlockedReasons,
    mailingAddressConfigured,
    deliveryCircuitBreaker,
    replyCapture,
  }
}

async function runLenderStage<T>(name: string, task: () => Promise<T>) {
  try {
    const result = await task()
    if (
      typeof result === 'object' &&
      result !== null &&
      'ok' in result &&
      (result as { ok?: unknown }).ok === false
    ) {
      const error = 'error' in result && typeof (result as { error?: unknown }).error === 'string'
        ? String((result as { error: string }).error)
        : `${name} reported an operational failure.`
      throw new Error(error)
    }
    return { ok: true as const, name, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logEvent({
      eventType: 'admin_action',
      entityType: 'lender_pipeline',
      entityId: name,
      metadata: { action: 'lender_automation_stage_failed', stage: name, error: message },
    }).catch(() => null)
    return { ok: false as const, name, error: message }
  }
}

export async function runDailyLenderApproval(limit = 20, options: { dryRun?: boolean } = {}) {
  const minimumScore = envInt('LENDER_AUTO_APPROVE_MIN_SCORE', 40)
  const candidates = await listLenderOutreachForAutoApproval(limit)
  const results: Array<{ lenderId: string | null; name: string; status: string; reason: string }> = []

  for (const message of candidates) {
    const lender = message.lenders as LenderRecord | null
    let approvalMessage: LenderOutreachMessageRecord = message
    let decision = evaluateLenderAutoApproval({
      lender,
      message: approvalMessage,
      templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
      minimumScore,
    })

    if (decision.reason === 'stale_template' && lender && !options.dryRun) {
      const refreshedMessages = await generateAndStoreLenderOutreach(lender)
      const refreshedIntro = refreshedMessages.find((candidate) => candidate.channel === 'email_intro')
      if (refreshedIntro) {
        approvalMessage = refreshedIntro
        decision = evaluateLenderAutoApproval({
          lender,
          message: approvalMessage,
          templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
          minimumScore,
        })
      }
    }

    if (!decision.approved || !lender) {
      results.push({ lenderId: lender?.id || null, name: lender?.name || 'Unknown lender', status: 'blocked', reason: decision.reason })
      continue
    }

    if (!options.dryRun) {
      await updateLenderOutreachMessage(approvalMessage.id, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        send_error: null,
      })
      await updateLenderRecord(lender.id, { outreach_status: 'approved', relationship_stage: 'outreach_ready' })
      await logEvent({
        eventType: 'outreach_approved',
        entityType: 'lender',
        entityId: lender.id,
        metadata: { messageId: approvalMessage.id, templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION, minimumScore },
      })
    }
    results.push({
      lenderId: lender.id,
      name: lender.name,
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

export async function runDailyLenderPipeline(
  options: {
    dryRun?: boolean
    sendLimit?: number
    sendExecutor?: <T>(task: () => Promise<T>) => Promise<T>
  } = {}
) {
  const dryRun = Boolean(options.dryRun)
  const discovery = await runLenderStage('discovery', () => runDailyLenderDiscovery({ dryRun }))
  const scoringLimit = Math.min(
    50,
    envInt('LENDERS_DAILY_SCORE_LIMIT', 90),
    envInt('LENDERS_PIPELINE_SCORE_LIMIT_CAP', 30)
  )
  const scoring = await runLenderStage('scoring', async () => {
    const result: Awaited<ReturnType<typeof runDailyLenderScoring>> = dryRun
      ? {
          ok: true,
          partial: false,
          errorCount: 0,
          scoredCount: 0,
          hunterAttempted: 0,
          configured: false,
          count: 0,
          results: [],
          hunter: { enabled: false, attempted: 0, limit: 0, concurrency: 0 },
        }
      : await runDailyLenderScoring(scoringLimit)
    if (!result.ok) {
      throw new Error(result.error || 'Lender scoring completed with unresolved record failures.')
    }
    return result
  })
  const outreach = await runLenderStage('outreach', () =>
    dryRun ? Promise.resolve({ ok: true, count: 0, results: [] }) : runDailyLenderOutreach(envInt('LENDERS_DAILY_OUTREACH_LIMIT', 30))
  )
  const followup = await runLenderStage('followup', () =>
    runDailyLenderFollowup(envInt('LENDERS_DAILY_FOLLOWUP_LIMIT', 25), { dryRun })
  )
  const approval = await runLenderStage('approval', () =>
    runDailyLenderApproval(envInt('LENDERS_DAILY_APPROVAL_LIMIT', 20), { dryRun })
  )
  const executeSend = () =>
    runDailyLenderSend(options.sendLimit ?? envInt('LENDERS_DAILY_SEND_LIMIT', 15), { dryRun })
  const send = await runLenderStage('send', () =>
    options.sendExecutor ? options.sendExecutor(executeSend) : executeSend()
  )
  const performance = await runLenderStage('performance', () =>
    dryRun ? Promise.resolve({ ok: true, count: 0, results: [] }) : runDailyLenderPerformanceRollup()
  )
  const stages = { discovery, scoring, outreach, followup, approval, send, performance }
  return {
    ok: Object.values(stages).every((stage) => stage.ok),
    partial: Object.values(stages).some((stage) => !stage.ok),
    stages,
  }
}
