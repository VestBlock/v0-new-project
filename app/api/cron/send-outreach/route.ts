export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runDailyLeadSendQueue } from '@/lib/leads/dailyAutomation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
    const limit = Number.parseInt(url.searchParams.get('limit') || '', 10)
    const result = await runDailyLeadSendQueue({
      dryRun,
      sendLimit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    })
    return NextResponse.json({ success: true, dryRun, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Outreach send failed.' },
      { status: 500 }
    )
  }
}
