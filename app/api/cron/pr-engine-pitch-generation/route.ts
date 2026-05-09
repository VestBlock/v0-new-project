export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { runPrPitchAutomation } from '@/lib/pr/engine'
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
    const limit = Number.parseInt(url.searchParams.get('limit') || '8', 10)
    const result = await runPrPitchAutomation({ dryRun, limit })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PR pitch generation failed.' },
      { status: 500 }
    )
  }
}
