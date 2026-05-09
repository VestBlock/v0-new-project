export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runDailyLeadScoring } from '@/lib/leads/dailyAutomation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '', 10)

    if (Number.isFinite(limit) && limit > 0) {
      process.env.LEADS_DAILY_SCORE_LIMIT = String(limit)
    }

    const result = await runDailyLeadScoring()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lead scoring failed.' },
      { status: 500 }
    )
  }
}
