export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { runDailyBuyerSend } from '@/lib/buyers/automation'
import { runDailyLenderSend } from '@/lib/lenders/automation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function envInt(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')

    const [lenders, buyers] = await Promise.all([
      runDailyLenderSend(envInt('LENDER_AUTO_SEND_LIMIT', 12), { dryRun }),
      runDailyBuyerSend(envInt('BUYER_AUTO_SEND_LIMIT', 12), { dryRun }),
    ])

    return NextResponse.json({
      success: true,
      dryRun,
      ok: true,
      lenders,
      buyers,
      sentCount:
        lenders.results.filter((item) => item.status === 'sent' || item.status === 'would_send').length +
        buyers.results.filter((item) => item.status === 'sent' || item.status === 'would_send').length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Partner send autopilot failed.' },
      { status: 500 }
    )
  }
}
