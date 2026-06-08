export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { runVisibilityIndexingPush } from '@/lib/seo/indexingPush'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function parsePositiveIntParam(value: string | null) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseUrlList(value: string | null) {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes', 'on'].includes(
      url.searchParams.get('dryRun')?.toLowerCase() || ''
    )
    const result = await runVisibilityIndexingPush({
      dryRun,
      inspectLimit: parsePositiveIntParam(url.searchParams.get('inspectLimit')),
      urls: parseUrlList(url.searchParams.get('urls')),
    })

    return NextResponse.json(result, { status: result.ok || result.dryRun ? 200 : 207 })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Visibility indexing push failed.',
      },
      { status: 500 }
    )
  }
}
