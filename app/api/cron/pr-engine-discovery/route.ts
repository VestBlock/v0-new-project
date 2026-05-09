export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { runPrTargetDiscovery } from '@/lib/pr/engine'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(
      url.searchParams.get('dryRun')?.toLowerCase() || ''
    )
    const cityLimit = Number.parseInt(url.searchParams.get('cityLimit') || '5', 10)
    const result = await runPrTargetDiscovery({ dryRun, cityLimit })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PR target discovery failed.' },
      { status: 500 }
    )
  }
}
