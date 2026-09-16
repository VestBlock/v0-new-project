export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { runDailyInvestorSend } from '@/lib/investors/service'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function enabled(value: string | null | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '', 10)
    const liveRequested = enabled(url.searchParams.get('send')) && !enabled(url.searchParams.get('dryRun'))
    const liveEnabled =
      enabled(process.env.INVESTORS_PIPELINE_CRON_SEND) &&
      enabled(process.env.INVESTOR_AUTO_SEND_ENABLED)
    if (liveRequested && !liveEnabled) {
      return NextResponse.json(
        { error: 'Investor live send is disabled by the production safety gates.' },
        { status: 409 }
      )
    }
    const dryRun = !liveRequested || !liveEnabled
    const invocationId = `investors-send:${randomUUID()}`
    const requestedLimit = Number.isFinite(limit) && limit > 0 ? limit : 2
    const result = await runDailyInvestorSend(Math.min(2, requestedLimit), { dryRun, invocationId })
    return NextResponse.json(
      { success: result.ok, dryRun, ...result, invocationId },
      { status: result.ok ? 200 : 500 }
    )
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Investor send failed.' }, { status: 500 })
  }
}
