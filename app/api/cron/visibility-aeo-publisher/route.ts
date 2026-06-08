export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { runDailyContentPublisher } from '@/lib/content/dailyPublisher'
import { aeoVisibilityRequirements } from '@/lib/seo/aeoVisibilityRequirements'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/system/cronAuth'

const visibilityClusters = [
  'dealvault',
  'search-visibility',
  'ai-receptionist',
  'website-conversion',
  'funding',
] as const

function parsePositiveIntParam(value: string | null, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function isDryRun(request: Request) {
  const url = new URL(request.url)
  return ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const limit = parsePositiveIntParam(
      url.searchParams.get('limit'),
      Number.parseInt(process.env.VISIBILITY_AEO_PUBLISH_LIMIT || '5', 10) || 5
    )

    const result = await runDailyContentPublisher({
      supabase: createAdminClient(),
      actorUserId: null,
      dryRun: isDryRun(request),
      limit,
      preferSpanish: false,
      clusters: [...visibilityClusters],
    })

    return NextResponse.json({
      success: true,
      visibilityRequirementCount: aeoVisibilityRequirements.length,
      clusters: visibilityClusters,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Visibility AEO publisher failed.',
      },
      { status: 500 }
    )
  }
}
