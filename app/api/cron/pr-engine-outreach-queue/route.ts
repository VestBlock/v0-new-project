export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { queueApprovedPrOutreach } from '@/lib/pr/engine'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
    const limit = Number.parseInt(url.searchParams.get('limit') || '', 10)

    const result = await queueApprovedPrOutreach({
      dryRun,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      actorUserId: null,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'PR outreach queue failed.' },
      { status: 500 }
    )
  }
}
