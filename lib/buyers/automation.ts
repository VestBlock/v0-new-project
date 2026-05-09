import { adminTaskDueDates, createAdminTask } from '@/lib/admin/tasks'
import { sendEmail } from '@/lib/email/sendEmail'
import { DEFAULT_BUYER_DISCOVERY_MARKETS, DEFAULT_BUYER_DISCOVERY_NICHES } from '@/lib/buyers/constants'
import { listMarketsForExpansionLane, pickDiscoveryTermsForMarket } from '@/lib/leads/marketExpansion'
import { sendBuyerOutreachEmail } from '@/lib/buyers/outbound'
import {
  finishBuyerOutreachRun,
  listApprovedBuyerEmailOutreach,
  updateBuyerOutreachMessage,
  updateBuyerPerformance,
  updateBuyerRecord,
  startBuyerOutreachRun,
} from '@/lib/buyers/repository'
import {
  discoverAndIngestBuyersForMarket,
  runDailyBuyerFollowup,
  runDailyBuyerOutreach,
  runDailyBuyerPerformanceRollup,
  runDailyBuyerScoring,
} from '@/lib/buyers/service'
import { isUsableContactEmail } from '@/lib/outreach/email-quality'
import type { BuyerRecord } from '@/lib/buyers/types'
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

export async function runDailyBuyerSend(limit = 15, options: { dryRun?: boolean } = {}) {
  const autoSend = envBool('BUYER_AUTO_SEND_ENABLED', true)
  const approved = await listApprovedBuyerEmailOutreach(limit)
  const results: Array<{ buyerId: string; name: string; status: string }> = []

  for (const row of approved) {
    const buyer = row.buyers as BuyerRecord | null
    if (!buyer?.id) continue

    if (!autoSend) {
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

    if (options.dryRun) {
      results.push({ buyerId: buyer.id, name: buyer.name, status: 'would_send' })
      continue
    }

    const sent = await sendBuyerOutreachEmail({ buyer, message: row })
    if (!sent.ok) {
      await updateBuyerOutreachMessage(row.id, {
        status: 'failed',
        send_provider: sent.provider,
        send_error: sent.error || 'Send failed.',
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
      continue
    }

    await updateBuyerOutreachMessage(row.id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_provider: sent.provider,
      send_error: null,
    })
    await updateBuyerRecord(buyer.id, {
      relationship_stage: 'contacted',
      outreach_status: 'sent',
      last_contacted_at: new Date().toISOString(),
      next_follow_up_at: adminTaskDueDates.days(4),
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
    results.push({ buyerId: buyer.id, name: buyer.name, status: 'sent' })
  }

  return { ok: true, count: results.length, results, autoSendEnabled: autoSend }
}

export async function runDailyBuyerPipeline(options: { dryRun?: boolean } = {}) {
  const discovery = await runDailyBuyerDiscovery({ dryRun: options.dryRun })
  const scoring = options.dryRun ? { ok: true, count: 0, results: [] } : await runDailyBuyerScoring(envInt('BUYERS_DAILY_SCORE_LIMIT', 90))
  const outreach = options.dryRun ? { ok: true, count: 0, results: [] } : await runDailyBuyerOutreach(envInt('BUYERS_DAILY_OUTREACH_LIMIT', 30))
  const followup = options.dryRun ? { ok: true, count: 0, results: [] } : await runDailyBuyerFollowup(envInt('BUYERS_DAILY_FOLLOWUP_LIMIT', 25))
  const performance = options.dryRun ? { ok: true, count: 0, results: [] } : await runDailyBuyerPerformanceRollup()
  return { ok: true, discovery, scoring, outreach, followup, performance }
}
