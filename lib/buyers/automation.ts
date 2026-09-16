import { randomUUID } from 'node:crypto'

import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { sendEmail } from '@/lib/email/sendEmail'
import { DEFAULT_BUYER_DISCOVERY_MARKETS, DEFAULT_BUYER_DISCOVERY_NICHES } from '@/lib/buyers/constants'
import { listMarketsForExpansionLane, pickDiscoveryTermsForMarket } from '@/lib/leads/marketExpansion'
import { sendBuyerOutreachEmail } from '@/lib/buyers/outbound'
import {
  claimBuyerOutreachMessageForSend,
  downgradeBuyerOutreachMessageIfApproved,
  finishBuyerOutreachRun,
  listApprovedBuyerEmailOutreach,
  listBuyerOutreachForAutoApproval,
  restoreBuyerOutreachMessageAfterQuotaDenial,
  updateBuyerOutreachMessage,
  updateBuyerPerformance,
  updateBuyerRecord,
  startBuyerOutreachRun,
} from '@/lib/buyers/repository'
import { evaluateBuyerAutoApproval } from '@/lib/buyers/automationCore'
import { BUYER_OUTREACH_TEMPLATE_VERSION } from '@/lib/buyers/outreach'
import {
  discoverAndIngestBuyersForMarket,
  runDailyBuyerFollowup,
  runDailyBuyerOutreach,
  runDailyBuyerPerformanceRollup,
  runDailyBuyerScoring,
} from '@/lib/buyers/service'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { resolvePipelineExecutionMode } from '@/lib/outreach/pipelineExecutionCore'
import { getOperationalReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import { getOutreachRecipientGuard } from '@/lib/outreach/suppression'
import { getCommercialOutreachMailingAddress } from '@/lib/outreach/commercialCompliance'
import {
  allocateDailyStrategyOutput,
  configuredDailyStrategyOutputTarget,
} from '@/lib/outreach/dailyStrategyOutputCore'
import { hasMicrosoftGraphApplicationCredentials } from '@/lib/email/microsoftGraphSend'
import { runQualifiedSellerBuyerRouting } from '@/lib/buyers/qualifiedSellerRouting'
import type { BuyerOutreachMessageRecord, BuyerRecord } from '@/lib/buyers/types'
import { logEvent } from '@/lib/system/logEvent'
import {
  hashHunterVerificationEmail,
  hunterVerificationReplacementScanLimit,
} from '@/lib/outreach/hunterSendVerificationCore'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

function buyerDailyOutputTarget(now = new Date()) {
  return allocateDailyStrategyOutput(configuredDailyStrategyOutputTarget(), now).byKey.buyers
}

function buildDigestHtml(title: string, items: string[]) {
  const rows = items.map((item) => `<li style="margin-bottom:8px;">${item}</li>`).join('')
  return `<div style="font-family:Arial,sans-serif;background:#081019;color:#eef6f8;padding:24px;"><h2 style="color:#fff;">${title}</h2><ul>${rows}</ul></div>`
}

async function sendAdminDigest(subject: string, title: string, items: string[]) {
  const recipient = (
    process.env.OPERATIONS_REPORT_EMAIL ||
    process.env.OUTREACH_ALERT_EMAIL ||
    process.env.ACQUISITIONS_ALERT_EMAIL ||
    process.env.ADMIN_ALERT_EMAIL ||
    'acquisitions@vestblock.io'
  ).trim()
  if (!recipient || items.length === 0) return { ok: false, skipped: true }
  return sendEmail({
    to: recipient,
    subject,
    html: buildDigestHtml(title, items),
    eventType: 'admin_lead_followup',
  })
}

export async function runDailyBuyerDiscovery(options: { dryRun?: boolean } = {}) {
  const run = await startBuyerOutreachRun({
    runType: 'daily_discovery',
    sourceKey: 'google_places_buyers',
    requestParams: { dryRun: options.dryRun || false },
  })

  try {
    const marketLimit = envInt('BUYERS_DAILY_MARKET_COUNT', 4)
    const results: Array<{ market: string; count: number }> = []
    const evolvingMarkets = await listMarketsForExpansionLane('buyers', { limit: marketLimit }).catch(() => [])
    const markets = evolvingMarkets.length
      ? evolvingMarkets.map((market) => ({
          city: market.city,
          state: market.state,
          metroArea: market.metro_area,
          niches: pickDiscoveryTermsForMarket(market, 'buyers', new Date(), envInt('BUYERS_DAILY_NICHE_COUNT', 4)),
        }))
      : DEFAULT_BUYER_DISCOVERY_MARKETS.slice(0, marketLimit).map((market) => ({
          ...market,
          niches: [...DEFAULT_BUYER_DISCOVERY_NICHES.slice(0, envInt('BUYERS_DAILY_NICHE_COUNT', 4))],
        }))
    for (const market of markets) {
      const buyers = options.dryRun
        ? []
        : await discoverAndIngestBuyersForMarket({
            city: market.city,
            state: market.state,
            metroArea: market.metroArea,
            niches: market.niches,
            limitPerNiche: envInt('BUYERS_DAILY_LIMIT_PER_NICHE', 3),
          })
      results.push({ market: `${market.city}, ${market.state}`, count: buyers.length })
    }

    await finishBuyerOutreachRun(run.id, {
      status: 'completed',
      resultCount: results.reduce((sum, item) => sum + item.count, 0),
    })

    if (!options.dryRun) {
      await sendAdminDigest(
        'VestBlock buyer discovery report',
        'Buyer discovery summary',
        results.map((item) => `${item.market}: ${item.count} buyer prospects`)
      )
    }

    return { ok: true, count: results.reduce((sum, item) => sum + item.count, 0), results }
  } catch (error) {
    await finishBuyerOutreachRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyBuyerSend(
  limit?: number,
  options: { dryRun?: boolean; invocationId?: string } = {}
) {
  const autoSendRequested = envBool('BUYER_AUTO_SEND_ENABLED', false)
  const invocationId = options.invocationId || `buyer-send:${randomUUID()}`
  const outlookConfigured = hasMicrosoftGraphApplicationCredentials()
  const replyCapture = await getOperationalReplyCaptureReadiness()
  const mailingAddressConfigured = Boolean(getCommercialOutreachMailingAddress())
  const sendGateOpen = autoSendRequested && outlookConfigured && replyCapture.ready && mailingAddressConfigured
  const autoSend = sendGateOpen && !options.dryRun
  const sendBlockedReasons = [
    !autoSendRequested ? 'buyer_auto_send_disabled' : null,
    autoSendRequested && !outlookConfigured ? 'outlook_graph_not_configured' : null,
    !replyCapture.ready ? 'reply_capture_not_configured' : null,
    !mailingAddressConfigured ? 'mailing_address_not_configured' : null,
  ].filter((reason): reason is string => Boolean(reason))
  const dailyLimit = buyerDailyOutputTarget()
  // The durable Outlook budget is authoritative; each invocation may request at most two.
  const effectiveLimit = Math.max(0, Math.min(limit ?? dailyLimit, dailyLimit, 2))
  const approved = effectiveLimit > 0
    ? await listApprovedBuyerEmailOutreach(hunterVerificationReplacementScanLimit(effectiveLimit))
    : []
  const results: Array<{ buyerId: string; name: string; status: string }> = []
  const providerFailureStopThreshold = envInt('OUTREACH_PROVIDER_FAILURE_STOP_THRESHOLD', 5)
  let providerFailureCount = 0
  let providerAttemptCount = 0

  for (const row of approved) {
    if (providerAttemptCount >= effectiveLimit) break
    const buyer = row.buyers as BuyerRecord | null
    if (!buyer?.id) continue

    const approvalDecision = evaluateBuyerAutoApproval({
      buyer,
      message: row as BuyerOutreachMessageRecord,
      templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
      minimumScore: envInt('BUYER_AUTO_APPROVE_MIN_SCORE', 40),
      allowedChannels: ['email_intro', 'email_followup', 'spanish_email'],
    })
    if (!approvalDecision.approved) {
      if (!options.dryRun) {
        const downgraded = await downgradeBuyerOutreachMessageIfApproved(row.id, {
          send_error: `approval_revalidation:${approvalDecision.reason}`,
        })
        if (!downgraded) {
          results.push({ buyerId: buyer.id, name: buyer.name, status: 'message_state_changed' })
          continue
        }
      }
      results.push({ buyerId: buyer.id, name: buyer.name, status: `approval_revalidation_blocked:${approvalDecision.reason}` })
      continue
    }

    if (!sendGateOpen) {
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'queued_for_review' })
      continue
    }

    if (!isUsableContactEmail(buyer.contact_email)) {
      if (!options.dryRun) {
        await createAdminTask({
          title: `Buyer autopilot blocked: ${buyer.name}`,
          description:
            'Approved buyer outreach could not send because there is no usable contact email. Enrich the buyer record or route a different channel.',
          taskType: 'buyer_autopilot_blocked',
          priority: 'high',
          entityType: 'buyer',
          entityId: buyer.id,
          dueAt: adminTaskDueDates.now(),
          metadata: { reason: 'invalid_email', messageId: row.id, channel: row.channel },
        }).catch(() => null)
      }
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'invalid_email' })
      continue
    }

    if (!autoSend) {
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'would_send' })
      continue
    }

    const finalRecipientGuard = await getOutreachRecipientGuard({
      scope: 'buyer',
      entityId: buyer.id,
      email: buyer.contact_email,
    })
    if (!finalRecipientGuard.allowed) {
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'suppression_blocked' })
      continue
    }

    const claimed = await claimBuyerOutreachMessageForSend(row.id, row.updated_at)
    if (!claimed) {
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'duplicate_claim_blocked' })
      continue
    }

    providerAttemptCount += 1
    const sent = await sendBuyerOutreachEmail({
      buyer,
      message: claimed,
      invocationId,
    })
    if (!sent.ok && sent.deferred) {
      const restored = await restoreBuyerOutreachMessageAfterQuotaDenial(
        claimed.id,
        claimed.updated_at
      ).catch(() => null)
      results.push({
        buyerId: buyer.id,
        name: buyer.name,
        status: restored ? 'delivery_deferred' : 'delivery_deferred_restore_failed',
      })
      if (!restored || sent.deferredScope !== 'record') break
      continue
    }
    if (sent.reconciliationRequired && !sent.ok) {
      await updateBuyerOutreachMessage(row.id, {
        status: 'queued',
        send_provider: 'outlook',
        send_error: sent.error || 'Outlook acceptance is unknown; reconciliation is required.',
        metadata_json: {
          ...(claimed.metadata_json || {}),
          idempotencyKey: sent.idempotencyKey,
          correlationId: sent.correlationId,
          dispatchId: sent.dispatchId,
          providerMessageId: sent.providerMessageId,
          internetMessageId: sent.internetMessageId,
          acceptanceStatus: sent.acceptanceStatus,
          reconciliationRequired: true,
        },
      })
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'reconciliation_required' })
      continue
    }
    if (!sent.ok) {
      await updateBuyerOutreachMessage(row.id, {
        status: 'failed',
        send_provider: sent.provider,
        send_error: sent.error || 'Send failed.',
        metadata_json: {
          ...(claimed.metadata_json || {}),
          idempotencyKey: sent.idempotencyKey || null,
          correlationId: sent.correlationId || null,
        },
      })
      await updateBuyerRecord(buyer.id, { outreach_status: 'failed' })
      await createAdminTask({
        title: `Buyer autopilot send failed: ${buyer.name}`,
        description:
          'Approved buyer outreach failed during auto-send. Review provider status, recipient quality, and whether the message should be retried manually.',
        taskType: 'buyer_autopilot_send_failed',
        priority: 'urgent',
        entityType: 'buyer',
        entityId: buyer.id,
        dueAt: adminTaskDueDates.now(),
        metadata: { reason: sent.error || 'send_failed', messageId: row.id, provider: sent.provider },
      }).catch(() => null)
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'failed' })
      providerFailureCount += 1
      if (providerFailureCount >= providerFailureStopThreshold) break
      continue
    }

    providerFailureCount = 0

    await updateBuyerOutreachMessage(row.id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_provider: sent.provider,
      send_error: null,
      metadata_json: {
        ...(claimed.metadata_json || {}),
        providerMessageId: sent.providerMessageId || null,
        internetMessageId: sent.internetMessageId,
        dispatchId: sent.dispatchId,
        providerAcceptedAt: new Date().toISOString(),
        idempotencyKey: sent.idempotencyKey || null,
        correlationId: sent.correlationId || null,
        acceptanceStatus: sent.acceptanceStatus,
        ledgerFinalized: sent.ledgerFinalized,
        reconciliationRequired: sent.reconciliationRequired,
        acceptedRecipientHash: hashHunterVerificationEmail(buyer.contact_email || ''),
      },
    })
    const isFollowup = row.channel === 'email_followup'
    const nextActionAt = isFollowup ? adminTaskDueDates.days(7) : adminTaskDueDates.days(4)
    await updateBuyerRecord(buyer.id, {
      relationship_stage: 'contacted',
      outreach_status: 'sent',
      last_contacted_at: new Date().toISOString(),
      next_follow_up_at: isFollowup ? null : nextActionAt,
    })
    await updateBuyerPerformance(buyer.id, {
      outreach_sent_count: ((buyer.metadata_json?.outreachSentCount as number) || 0) + 1,
      last_contacted_at: new Date().toISOString(),
    })
    await logEvent({
      eventType: 'buyer_outreach_sent',
      entityType: 'buyer',
      entityId: buyer.id,
      metadata: { messageId: row.id, provider: sent.provider },
    })
    await recordOutboundEnrollment({
      strategyKey: 'buyer-network',
      channel: 'email',
      status: 'accepted',
      messageId: row.id,
      recipient: buyer.contact_email,
      market: [buyer.headquarters_city, buyer.headquarters_state].filter(Boolean).join(', '),
      nextActionAt,
      metadata: {
        buyerId: buyer.id,
        buyerCategory: buyer.category,
        provider: sent.provider,
        providerMessageId: sent.providerMessageId || null,
        internetMessageId: sent.internetMessageId,
        dispatchId: sent.dispatchId,
        idempotencyKey: sent.idempotencyKey || null,
        correlationId: sent.correlationId || null,
        acceptanceStatus: sent.acceptanceStatus,
        ledgerFinalized: sent.ledgerFinalized,
        reconciliationRequired: sent.reconciliationRequired,
      },
    }).catch(() => null)
    results.push({ buyerId: buyer.id, name: buyer.name, status: 'accepted' })
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
    autoSendEnabled: autoSend,
    autoSendRequested,
    sendGateOpen,
    sendBlockedReasons,
    providerAttemptCount,
    mailingAddressConfigured,
    outlookConfigured,
    replyCapture,
    dailyLimit,
    effectiveLimit,
    invocationId,
  }
}

export async function runDailyBuyerApproval(
  limit = 20,
  options: { dryRun?: boolean } = {}
) {
  const minimumScore = envInt('BUYER_AUTO_APPROVE_MIN_SCORE', 40)
  const candidates = await listBuyerOutreachForAutoApproval(limit)
  const results: Array<{ buyerId: string | null; name: string; status: string; reason: string }> = []

  for (const message of candidates) {
    const buyer = message.buyers as BuyerRecord | null
    const decision = evaluateBuyerAutoApproval({
      buyer,
      message,
      templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
      minimumScore,
    })

    if (!decision.approved || !buyer) {
      results.push({
        buyerId: buyer?.id || null,
        name: buyer?.name || 'Unknown buyer',
        status: 'blocked',
        reason: decision.reason,
      })
      continue
    }

    if (!options.dryRun) {
      const approvedAt = new Date().toISOString()
      await updateBuyerOutreachMessage(message.id, {
        status: 'approved',
        approved_at: approvedAt,
        send_error: null,
      })
      await updateBuyerRecord(buyer.id, {
        outreach_status: 'approved',
        relationship_stage: 'outreach_ready',
      })
      await logEvent({
        eventType: 'outreach_approved',
        entityType: 'buyer',
        entityId: buyer.id,
        metadata: {
          messageId: message.id,
          templateVersion: BUYER_OUTREACH_TEMPLATE_VERSION,
          minimumScore,
          approvalMode: 'guarded_automation',
        },
      })
    }

    results.push({
      buyerId: buyer.id,
      name: buyer.name,
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

async function runBuyerStage<T>(name: string, task: () => Promise<T>) {
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
      entityType: 'buyer_pipeline',
      entityId: name,
      metadata: { action: 'buyer_automation_stage_failed', stage: name, error: message },
    }).catch(() => null)
    return { ok: false as const, name, error: message }
  }
}

export async function runDailyBuyerPipeline(
  options: {
    dryRun?: boolean
    deliveryEnabled?: boolean
    sendLimit?: number
    invocationId?: string
    sendExecutor?: <T>(task: () => Promise<T>) => Promise<T>
  } = {}
) {
  const executionMode = resolvePipelineExecutionMode(options)
  const { dryRun, deliveryEnabled, deliveryDryRun } = executionMode
  const dailyLaneTarget = buyerDailyOutputTarget()
  const sendLimit = Math.min(options.sendLimit ?? dailyLaneTarget, dailyLaneTarget)
  const pipelineRun = await startBuyerOutreachRun({
    runType: 'daily_pipeline',
    sourceKey: 'vestblock_buyer_pipeline',
    requestParams: {
      dryRun,
      deliveryEnabled,
      sendLimit,
      dailyLimit: dailyLaneTarget,
      strategyOutputTarget: configuredDailyStrategyOutputTarget(),
    },
  })

  try {
    const discovery = await runBuyerStage('discovery', () => runDailyBuyerDiscovery({ dryRun }))
    const scoringLimit = dailyLaneTarget
    const scoring = await runBuyerStage('scoring', () =>
      dryRun
        ? Promise.resolve({
            ok: true,
            count: 0,
            results: [],
            hunter: { enabled: false, attempted: 0, limit: 0, concurrency: 0 },
          })
        : runDailyBuyerScoring(scoringLimit)
    )
    const outreach = await runBuyerStage('outreach', () =>
      runDailyBuyerOutreach(dailyLaneTarget, { dryRun })
    )
    const followup = await runBuyerStage('followup', () =>
      runDailyBuyerFollowup(dailyLaneTarget, { dryRun })
    )
    const approval = await runBuyerStage('approval', () =>
      runDailyBuyerApproval(dailyLaneTarget, { dryRun })
    )
    const executeSend = () =>
      runDailyBuyerSend(sendLimit, { dryRun: deliveryDryRun, invocationId: options.invocationId })
    const send = await runBuyerStage('send', () =>
      options.sendExecutor ? options.sendExecutor(executeSend) : executeSend()
    )
    const performance = await runBuyerStage('performance', () =>
      dryRun ? Promise.resolve({ ok: true, count: 0, results: [] }) : runDailyBuyerPerformanceRollup()
    )
    const sellerRouting = await runBuyerStage('seller_routing', () =>
      runQualifiedSellerBuyerRouting(dailyLaneTarget, { dryRun, autoSend: deliveryEnabled })
    )
    const stages = { discovery, scoring, outreach, followup, approval, send, performance, sellerRouting }
    const ok = Object.values(stages).every((stage) => stage.ok)
    const partial = Object.values(stages).some((stage) => !stage.ok)
    const sendCount = send.ok
      ? Number(send.result.results?.filter((result) => result.status === (deliveryDryRun ? 'would_send' : 'accepted')).length || 0)
      : 0
    const failedStages = Object.values(stages)
      .filter((stage) => !stage.ok)
      .map((stage) => stage.name)

    await finishBuyerOutreachRun(pipelineRun.id, {
      status: ok ? 'completed' : 'partial',
      resultCount: sendCount,
      errorMessage: failedStages.length ? `Failed stages: ${failedStages.join(', ')}` : null,
    })

    return {
      ok,
      partial,
      runId: pipelineRun.id,
      dailyLaneTarget,
      stages,
    }
  } catch (error) {
    await finishBuyerOutreachRun(pipelineRun.id, {
      status: 'failed',
      resultCount: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    }).catch(() => null)
    throw error
  }
}
