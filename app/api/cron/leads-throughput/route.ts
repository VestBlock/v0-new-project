export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runLeadThroughputSprint } from '@/lib/leads/dailyAutomation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
    const target = Number.parseInt(url.searchParams.get('target') || '', 10)
    const budgetMs = Number.parseInt(url.searchParams.get('budgetMs') || '', 10)

    const result = await runLeadThroughputSprint({
      dryRun,
      sendLimit: Number.isFinite(target) && target > 0 ? target : undefined,
      budgetMs: Number.isFinite(budgetMs) && budgetMs >= 1000 ? budgetMs : undefined,
    })

    return NextResponse.json({
      success: true,
      dryRun,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lead throughput sprint failed.' },
      { status: 500 }
    )
  }
}
