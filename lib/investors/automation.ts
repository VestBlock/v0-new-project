import { sendEmail } from '@/lib/email/sendEmail'
import {
  DEFAULT_BUILDER_DISCOVERY_NICHES,
  DEFAULT_INVESTOR_DISCOVERY_MARKETS,
  DEFAULT_INVESTOR_DISCOVERY_NICHES,
} from '@/lib/investors/discovery'
import { BUILDER_PARTNER_MARKETS } from '@/lib/investors/builderStrategy'
import {
  discoverAndIngestInvestorsForMarket,
  runDailyInvestorApproval,
  runDailyInvestorFollowup,
  runDailyInvestorHunterEnrichment,
  runDailyInvestorOutreach,
  runDailyInvestorPerformanceRollup,
  runDailyInvestorScoring,
  runDailyInvestorSend,
} from '@/lib/investors/service'
import {
  finishInvestorAutomationRun,
  startInvestorAutomationRun,
} from '@/lib/investors/repository'
import {
  allocateDailyStrategyOutput,
  configuredDailyStrategyOutputTarget,
} from '@/lib/outreach/dailyStrategyOutputCore'
import { resolvePipelineExecutionMode } from '@/lib/outreach/pipelineExecutionCore'
import { logEvent } from '@/lib/system/logEvent'
import { isPaidSourceBudgetSkipError } from '@/lib/leads/paidSourceBudget'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function investorDailyOutputTarget(now = new Date()) {
  return allocateDailyStrategyOutput(configuredDailyStrategyOutputTarget(), now).byKey.investors
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

export async function runDailyInvestorDiscovery(options: { dryRun?: boolean; mode?: 'default' | 'builders' } = {}) {
  const run = await startInvestorAutomationRun({
    runType: 'daily_discovery',
    sourceKey: 'phase_one_investor_markets',
    requestParams: { dryRun: options.dryRun || false, mode: options.mode || 'default' },
  })

  try {
    const mode = options.mode || 'default'
    const isBuilderMode = mode === 'builders'
    const marketLimit = isBuilderMode
      ? envInt('INVESTORS_DAILY_BUILDER_MARKET_COUNT', 1)
      : envInt('INVESTORS_DAILY_MARKET_COUNT', DEFAULT_INVESTOR_DISCOVERY_MARKETS.length)
    const nicheLimit = isBuilderMode
      ? envInt('INVESTORS_DAILY_BUILDER_NICHE_COUNT', 2)
      : envInt('INVESTORS_DAILY_NICHE_COUNT', 6)
    const limitPerNiche = isBuilderMode
      ? envInt('INVESTORS_DAILY_BUILDER_LIMIT_PER_NICHE', 2)
      : envInt('INVESTORS_DAILY_LIMIT_PER_NICHE', 3)
    const results: Array<{
      market: string
      count: number
      status: 'completed' | 'skipped' | 'failed'
      detail?: string | null
    }> = []
    const markets =
      (mode === 'builders' ? [...BUILDER_PARTNER_MARKETS] : DEFAULT_INVESTOR_DISCOVERY_MARKETS).slice(
        0,
        marketLimit
      )
    const niches =
      (mode === 'builders' ? [...DEFAULT_BUILDER_DISCOVERY_NICHES] : DEFAULT_INVESTOR_DISCOVERY_NICHES).slice(
        0,
        nicheLimit
      )

    for (const market of markets) {
      try {
        const investors = options.dryRun
          ? []
          : await discoverAndIngestInvestorsForMarket({
              city: market.city,
              state: market.state,
              metroArea: market.metroArea,
              niches,
              limitPerNiche,
            })
        results.push({
          market: `${market.city}, ${market.state}`,
          count: investors.length,
          status: 'completed',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 240) : 'Discovery failed.'
        results.push({
          market: `${market.city}, ${market.state}`,
          count: 0,
          status: isPaidSourceBudgetSkipError(error) ? 'skipped' : 'failed',
          detail: message,
        })
      }
    }

    const count = results.reduce((sum, item) => sum + item.count, 0)
    const errorCount = results.filter((item) => item.status === 'failed').length
    const skippedCount = results.filter((item) => item.status === 'skipped').length
    const ok = errorCount === 0
    const partial = skippedCount > 0 || (errorCount > 0 && errorCount < results.length)
    await finishInvestorAutomationRun(run.id, {
      status: ok ? 'completed' : 'failed',
      resultCount: count,
      errorMessage:
        errorCount > 0
          ? `${errorCount} of ${results.length} investor discovery market(s) failed.`
          : skippedCount > 0
            ? `${skippedCount} of ${results.length} investor discovery market(s) skipped by the paid-source guard.`
            : null,
    })

    if (!options.dryRun) {
      await sendAdminDigest(
        mode === 'builders' ? 'VestBlock builder discovery report' : 'VestBlock investor discovery report',
        mode === 'builders' ? 'Builder discovery summary' : 'Investor discovery summary',
        results.map((item) =>
          item.status !== 'completed'
            ? `${item.market}: discovery ${item.status} — ${item.detail}`
            : `${item.market}: ${item.count} ${mode === 'builders' ? 'builder / construction prospects' : 'investor prospects'}`
        )
      )
    }

    return {
      ok,
      partial,
      errorCount,
      skippedCount,
      mode,
      count,
      results,
      markets: markets.map((market) => `${market.city}, ${market.state}`),
      niches,
    }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function runDailyInvestorPipeline(
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
  const dailyLaneTarget = investorDailyOutputTarget()
  const sendLimit = Math.min(options.sendLimit ?? dailyLaneTarget, dailyLaneTarget)
  const run = await startInvestorAutomationRun({
    runType: 'pipeline',
    sourceKey: 'investor_relationship_engine',
    requestParams: { dryRun, deliveryEnabled },
  })

  try {
    const discovery = await runDailyInvestorDiscovery({ dryRun })
    const enrichment = dryRun
      ? {
          ok: true,
          partial: false,
          configured: Boolean(process.env.HUNTER_API_KEY),
          count: 0,
          enrichedCount: 0,
          errorCount: 0,
          results: [],
        }
      : await runDailyInvestorHunterEnrichment(dailyLaneTarget).catch(async () => {
          const message = 'Investor Hunter enrichment stage failed unexpectedly.'
          await logEvent({
            eventType: 'admin_action',
            entityType: 'investor_pipeline',
            entityId: 'enrichment',
            metadata: { action: 'investor_enrichment_stage_failed', error: message },
          }).catch(() => null)
          return {
            ok: false,
            partial: false,
            configured: Boolean(process.env.HUNTER_API_KEY),
            count: 0,
            enrichedCount: 0,
            errorCount: 1,
            results: [],
            error: message,
          }
        })
    const scoring = dryRun ? { ok: true, count: 0, results: [] } : await runDailyInvestorScoring(dailyLaneTarget)
    const outreach = dryRun ? { ok: true, count: 0, results: [] } : await runDailyInvestorOutreach(dailyLaneTarget)
    const followup = await runDailyInvestorFollowup(dailyLaneTarget, { dryRun })
    const approval = await runDailyInvestorApproval(dailyLaneTarget, { dryRun })
    const executeSend = () =>
      runDailyInvestorSend(sendLimit, { dryRun: deliveryDryRun, invocationId: options.invocationId })
    const send = options.sendExecutor ? await options.sendExecutor(executeSend) : await executeSend()
    const performance = dryRun ? { ok: true, count: 0, results: [] } : await runDailyInvestorPerformanceRollup()

    const count = discovery.count + enrichment.count + scoring.count + outreach.count + followup.count + approval.count + send.count + performance.count
    const stages = [discovery, enrichment, scoring, outreach, followup, approval, send, performance]
    const ok = stages.every((stage) => stage.ok !== false)
    await finishInvestorAutomationRun(run.id, {
      status: ok ? 'completed' : 'failed',
      resultCount: count,
      errorMessage: ok
        ? null
        : 'Investor pipeline completed with one or more failed stages. Inspect the stage results before retrying.',
    })
    return { ok, partial: !ok, dailyLaneTarget, discovery, enrichment, scoring, outreach, followup, approval, send, performance }
  } catch (error) {
    await finishInvestorAutomationRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
