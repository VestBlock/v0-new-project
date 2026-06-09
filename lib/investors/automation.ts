import { sendEmail } from '@/lib/email/sendEmail'
import {
  DEFAULT_INVESTOR_DISCOVERY_MARKETS,
  DEFAULT_INVESTOR_DISCOVERY_NICHES,
} from '@/lib/investors/discovery'
import {
  discoverAndIngestInvestorsForMarket,
  runDailyInvestorFollowup,
  runDailyInvestorOutreach,
  runDailyInvestorPerformanceRollup,
  runDailyInvestorScoring,
  runDailyInvestorSend,
} from '@/lib/investors/service'
import {
  finishInvestorAutomationRun,
  startInvestorAutomationRun,
} from '@/lib/investors/repository'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char] || char
  })
}

function buildDigestHtml(title: string, items: string[]) {
  const rows = items.map((item) => `<li style="margin-bottom:8px;">${escapeHtml(item)}</li>`).join('')
  return `<div style="font-family:Arial,sans-serif;background:#081019;color:#eef6f8;padding:24px;"><h2 style="color:#fff;">${escapeHtml(title)}</h2><ul>${rows}</ul></div>`
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

export async function runDailyInvestorDiscovery(options: { dryRun?: boolean } = {}) {
  const run = await startInvestorAutomationRun({
    runType: 'daily_discovery',
    sourceKey: 'phase_one_investor_markets',
    requestParams: { dryRun: options.dryRun || false },
  })

  try {
    const marketLimit = envInt('INVESTORS_DAILY_MARKET_COUNT', DEFAULT_INVESTOR_DISCOVERY_MARKETS.length)
    const nicheLimit = envInt('INVESTORS_DAILY_NICHE_COUNT', 6)
    const limitPerNiche = envInt('INVESTORS_DAILY_LIMIT_PER_NICHE', 3)
    const results: Array<{ market: string; count: number }> = []
    const markets = DEFAULT_INVESTOR_DISCOVERY_MARKETS.slice(0, marketLimit)
    const niches = DEFAULT_INVESTOR_DISCOVERY_NICHES.slice(0, nicheLimit)

    for (const market of markets) {
      const investors = options.dryRun
        ? []
        : await discoverAndIngestInvestorsForMarket({
            city: market.city,
            state: market.state,
            metroArea: market.metroArea,
            niches,
            limitPerNiche,
          })
      results.push({ market: `${market.city}, ${market.state}`, count: investors.length })
    }

    const count = results.reduce((sum, item) => sum + item.count, 0)
    await finishInvestorAutomationRun(run.id, { status: 'completed', resultCount: count })

    if (!options.dryRun) {
      await sendAdminDigest(
        'VestBlock investor discovery report',
        'Investor discovery summary',
        results.map((item) => `${item.market}: ${item.count} investor prospects`)
      )
    }

    return { ok: true, count, results, markets: markets.map((market) => `${market.city}, ${market.state}`), niches }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyInvestorPipeline(options: { dryRun?: boolean } = {}) {
  const run = await startInvestorAutomationRun({
    runType: 'pipeline',
    sourceKey: 'investor_relationship_engine',
    requestParams: { dryRun: options.dryRun || false },
  })

  try {
    const discovery = await runDailyInvestorDiscovery({ dryRun: options.dryRun })
    const scoring = options.dryRun ? { ok: true, count: 0, results: [] } : await runDailyInvestorScoring(envInt('INVESTORS_DAILY_SCORE_LIMIT', 120))
    const outreach = options.dryRun ? { ok: true, count: 0, results: [] } : await runDailyInvestorOutreach(envInt('INVESTORS_DAILY_OUTREACH_LIMIT', 50))
    const send = options.dryRun ? { ok: true, count: 0, results: [], autoSendEnabled: false } : await runDailyInvestorSend(envInt('INVESTORS_DAILY_SEND_LIMIT', 20))
    const followup = options.dryRun ? { ok: true, count: 0, results: [] } : await runDailyInvestorFollowup(envInt('INVESTORS_DAILY_FOLLOWUP_LIMIT', 30))
    const performance = options.dryRun ? { ok: true, count: 0, results: [] } : await runDailyInvestorPerformanceRollup()

    const count = discovery.count + scoring.count + outreach.count + send.count + followup.count + performance.count
    await finishInvestorAutomationRun(run.id, { status: 'completed', resultCount: count })
    return { ok: true, discovery, scoring, outreach, send, followup, performance }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
