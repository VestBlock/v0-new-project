export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'

import { runDailyLeadFollowup } from '@/lib/leads/dailyAutomation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function flag(value: string | null, fallback: boolean) {
  if (value === null) return fallback
  return /^(1|true|yes|on)$/i.test(value)
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '', 10)
    const dryRun = flag(url.searchParams.get('dryRun'), false)
    const excludeDealMachine = flag(url.searchParams.get('excludeDealMachine'), true)
    const result = await runDailyLeadFollowup({
      dryRun,
      followupLimit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      excludeSourcePatterns: excludeDealMachine ? ['dealmachine'] : [],
    })
    return NextResponse.json({
      success: result.ok,
      dryRun,
      dealMachineExcluded: excludeDealMachine,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Seller follow-up failed.' },
      { status: 500 }
    )
  }
}
