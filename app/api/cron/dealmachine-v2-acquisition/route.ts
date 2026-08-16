export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'

import { runDealMachinePropertyDiscovery } from '@/lib/dealmachine/api'
import {
  hasDealMachineCredentials,
  isDealMachineDiscoveryEnabled,
} from '@/lib/dealmachine/v2-client.mjs'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function integer(value: string | null | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isDealMachineDiscoveryEnabled()) {
    return NextResponse.json({
      ok: false,
      configured: hasDealMachineCredentials(),
      discoveryEnabled: false,
      paidSearchEnabled: false,
      error: 'DealMachine discovery is disabled; no provider request was made.',
    }, { status: 503 })
  }
  if (!hasDealMachineCredentials()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      discoveryEnabled: true,
      paidSearchEnabled: false,
      error: 'DEALMACHINE_API_KEY is not configured with a current official v2 credential.',
    }, { status: 503 })
  }

  const url = new URL(request.url)
  const result = await runDealMachinePropertyDiscovery({
    mode: 'count_only',
    maxStrategies: integer(
      url.searchParams.get('maxStrategies'),
      integer(process.env.DEALMACHINE_COUNT_STRATEGIES_PER_RUN, 3, 1, 16),
      1,
      16
    ),
    startAfter: integer(url.searchParams.get('startAfter'), 0, 0, 15),
  })

  return NextResponse.json({
    ok: result.ok,
    configured: result.configured,
    discoveryEnabled: result.discoveryEnabled,
    paidSearchEnabled: false,
    mode: result.mode,
    matchingProperties: result.matchingProperties,
    strategiesChecked: result.strategyRuns.length,
    startAfter: result.startAfter,
    nextAfter: result.nextAfter,
    wrapped: result.wrapped,
    blocker: result.blockedReason,
    strategyRuns: result.strategyRuns,
  }, { status: result.ok ? 200 : 503 })
}
