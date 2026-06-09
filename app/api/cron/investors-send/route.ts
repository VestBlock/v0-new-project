export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runDailyInvestorSend } from '@/lib/investors/service'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '', 10)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
    const result = await runDailyInvestorSend(Number.isFinite(limit) && limit > 0 ? limit : undefined, { dryRun })
    return NextResponse.json({ success: true, dryRun, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Investor send failed.' }, { status: 500 })
  }
}
