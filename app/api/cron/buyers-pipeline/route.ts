export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { runDailyBuyerPipeline } from '@/lib/buyers/automation'
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
    const dryRun = enabled(url.searchParams.get('dryRun'))
    const deliveryEnabled = enabled(process.env.BUYERS_PIPELINE_CRON_SEND) && !dryRun
    const invocationId = `buyers-pipeline:${randomUUID()}`
    const result = await runDailyBuyerPipeline({
      dryRun,
      deliveryEnabled,
      sendLimit: 2,
      invocationId,
    })
    return NextResponse.json(
      { success: result.ok, dryRun, deliveryEnabled, invocationId, ...result },
      { status: result.ok ? 200 : 500 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Buyer pipeline failed.' },
      { status: 500 }
    )
  }
}
