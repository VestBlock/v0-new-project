import { createAdminTask, adminTaskDueDates } from '@/lib/admin/tasks'
import { recordOutboundEnrollment } from '@/lib/admin/outboundEnrollment'
import { sendEmail } from '@/lib/email/sendEmail'
import { DEFAULT_LENDER_DISCOVERY_MARKETS, DEFAULT_LENDER_DISCOVERY_NICHES } from '@/lib/lenders/constants'
import { listMarketsForExpansionLane, pickDiscoveryTermsForMarket } from '@/lib/leads/marketExpansion'
import { getDeliveryCircuitBreaker } from '@/lib/leads/deliveryHealth'
import { getReplyCaptureReadiness } from '@/lib/outreach/reply-capture'
import { sendLenderOutreachEmail } from '@/lib/lenders/outbound'
import {
  finishLenderOutreachRun,
  listApprovedLenderEmailOutreach,
  listLenderOutreachForAutoApproval,
  updateLenderOutreachMessage,
  updateLenderPerformance,
  updateLenderRecord,
} from '@/lib/lenders/repository'
import {
  discoverAndIngestLendersForMarket,
  runDailyLenderFollowup,
  runDailyLenderOutreach,
  runDailyLenderPerformanceRollup,
  runDailyLenderScoring,
} from '@/lib/lenders/service'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import { evaluateLenderAutoApproval } from '@/lib/lenders/automationCore'
import { LENDER_OUTREACH_TEMPLATE_VERSION } from '@/lib/lenders/outreach'
import { startLenderOutreachRun } from '@/lib/lenders/repository'
import type { LenderRecord } from '@/lib/lenders/types'
import { logEvent } from '@/lib/system/logEvent'

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

export async function runDailyLenderSend(limit = 15, options: { dryRun?: boolean } = {}) {
  const autoSendRequested = envBool('LENDER_AUTO_SEND_ENABLED', false)
  const deliveryCircuitBreaker = autoSendRequested ? await getDeliveryCircuitBreaker() : null
  const replyCapture = getReplyCaptureReadiness()
  const autoSend = autoSendRequested && deliveryCircuitBreaker?.allowed === true && replyCapture.ready
  const approved = await listApprovedLenderEmailOutreach(limit)
  const results: Array<{ lenderId: string; name: string; status: string }> = []

  for (const row of approved) {
    const lender = row.lenders as LenderRecord | null
    if (!lender?.id) continue

    if (!autoSend) {
      results.push({ lenderId: lender.id, name: lender.name, status: 'queued_for_review' })
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

    if (options.dryRun) {
      results.push({ lenderId: lender.id, name: lender.name, status: 'would_send' })
      continue
    }

    const sent = await sendLenderOutreachEmail({ lender, message: row })
    if (!sent.ok) {
      await updateLenderOutreachMessage(row.id, {
        status: 'failed',
        send_provider: sent.provider,
        send_error: sent.error || 'Send failed.',
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
        ...(row.metadata_json || {}),
        providerMessageId: sent.providerMessageId || null,
        providerAcceptedAt: new Date().toISOString(),
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
      },
    }).catch(() => null)
    results.push({ lenderId: lender.id, name: lender.name, status: 'accepted' })
  }

  return { ok: true, count: results.length, results, autoSendEnabled: autoSend, autoSendRequested, deliveryCircuitBreaker, replyCapture }
}

async function runLenderStage<T>(name: string, task: () => Promise<T>) {
  try {
    return { ok: true as const, name, result: await task() }
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
    const decision = evaluateLenderAutoApproval({
      lender,
      message,
      templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION,
      minimumScore,
    })
    if (!decision.approved || !lender) {
      results.push({ lenderId: lender?.id || null, name: lender?.name || 'Unknown lender', status: 'blocked', reason: decision.reason })
      continue
    }

    if (!options.dryRun) {
      await updateLenderOutreachMessage(message.id, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        send_error: null,
      })
      await updateLenderRecord(lender.id, { outreach_status: 'approved', relationship_stage: 'outreach_ready' })
      await logEvent({
        eventType: 'outreach_approved',
        entityType: 'lender',
        entityId: lender.id,
        metadata: { messageId: message.id, templateVersion: LENDER_OUTREACH_TEMPLATE_VERSION, minimumScore },
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

export async function runDailyLenderPipeline(options: { dryRun?: boolean } = {}) {
  const dryRun = Boolean(options.dryRun)
  const discovery = await runLenderStage('discovery', () => runDailyLenderDiscovery({ dryRun }))
  const scoring = await runLenderStage('scoring', () =>
    dryRun ? Promise.resolve({ ok: true, count: 0, results: [] }) : runDailyLenderScoring(envInt('LENDERS_DAILY_SCORE_LIMIT', 90))
  )
  const outreach = await runLenderStage('outreach', () =>
    dryRun ? Promise.resolve({ ok: true, count: 0, results: [] }) : runDailyLenderOutreach(envInt('LENDERS_DAILY_OUTREACH_LIMIT', 30))
  )
  const followup = await runLenderStage('followup', () =>
    runDailyLenderFollowup(envInt('LENDERS_DAILY_FOLLOWUP_LIMIT', 25), { dryRun })
  )
  const approval = await runLenderStage('approval', () =>
    runDailyLenderApproval(envInt('LENDERS_DAILY_APPROVAL_LIMIT', 20), { dryRun })
  )
  const send = await runLenderStage('send', () =>
    runDailyLenderSend(envInt('LENDERS_DAILY_SEND_LIMIT', 15), { dryRun })
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
