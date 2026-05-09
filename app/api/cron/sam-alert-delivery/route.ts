export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/system/cronAuth'
import { buildSamPausedResponse, isSamAutomationEnabled } from '@/lib/sam/automation'
import { runSamAlertDelivery } from '@/lib/sam/service'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (!isSamAutomationEnabled()) {
    return buildSamPausedResponse()
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
    const result = await runSamAlertDelivery({ dryRun })
    return NextResponse.json({ success: true, dryRun, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SAM alert delivery failed.' },
      { status: 500 }
    )
  }
}
