export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { runLinkedInTaskQueue } from '@/lib/partners/linkedinTaskQueue'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function positiveInt(value: string | null) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(
      url.searchParams.get('dryRun')?.toLowerCase() || ''
    )
    const result = await runLinkedInTaskQueue({
      dryRun,
      limit: positiveInt(url.searchParams.get('limit')),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'LinkedIn task queue failed.',
      },
      { status: 500 }
    )
  }
}
