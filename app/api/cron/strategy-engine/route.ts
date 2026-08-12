export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'

import { runStrategyExecutionEngine } from '@/lib/admin/strategyExecutionEngine'
import type { StrategySourceProvider } from '@/lib/admin/strategyExecutionCatalog'
import { isCronAuthorized } from '@/lib/system/cronAuth'

const SOURCE_PROVIDERS: StrategySourceProvider[] = ['property_intelligence', 'homeharvest', 'public_records', 'dealmachine']

function flag(value: string | null) {
  if (value === null) return null
  return /^(1|true|yes|on)$/i.test(value)
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>
    return [row.message, row.details, row.hint, row.code].filter(Boolean).map(String).join(' | ') || JSON.stringify(row)
  }
  return String(error || 'Strategy engine execution failed.')
}

function providerList(value: string | null) {
  if (!value) return []
  const requested = new Set(
    value
      .split(',')
      .map((provider) => provider.trim().toLowerCase())
      .filter(Boolean)
  )
  return SOURCE_PROVIDERS.filter((provider) => requested.has(provider))
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const execute = flag(url.searchParams.get('execute')) ?? process.env.STRATEGY_ENGINE_EXECUTION_ENABLED === 'true'
    const maxLaneRuns = Number.parseInt(url.searchParams.get('maxLaneRuns') || '', 10)
    const syncDealMachine = flag(url.searchParams.get('syncDealMachine'))
    const includedProviders = providerList(url.searchParams.get('providers'))
    const excludedProviders = new Set(providerList(url.searchParams.get('excludeProviders')))
    const sourceProviders = (includedProviders.length ? includedProviders : SOURCE_PROVIDERS)
      .filter((provider) => !excludedProviders.has(provider))
    if (!sourceProviders.length) {
      return NextResponse.json({ error: 'At least one valid source provider is required.' }, { status: 400 })
    }
    const result = await runStrategyExecutionEngine({
      dryRun: !execute,
      maxLaneRuns: Number.isFinite(maxLaneRuns) && maxLaneRuns > 0 ? maxLaneRuns : undefined,
      syncDealMachine:
        syncDealMachine ?? /^(1|true|yes|on)$/i.test(String(process.env.DEALMACHINE_SOURCE_ENABLED || '')),
      sourceProviders,
    })
    return NextResponse.json({ success: true, executionEnabled: execute, ...result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: errorMessage(error),
      },
      { status: 500 }
    )
  }
}
