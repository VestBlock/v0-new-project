export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getDailyPublisherConfigFromEnv, runDailyContentPublisher } from '@/lib/content/dailyPublisher'
import { createAdminClient } from '@/lib/supabase/admin'
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
    const config = getDailyPublisherConfigFromEnv()
    const result = await runDailyContentPublisher({
      supabase: createAdminClient(),
      actorUserId: null,
      dryRun,
      ...config,
    })

    return NextResponse.json({
      success: true,
      dryRun,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Daily content publisher failed.',
      },
      { status: 500 }
    )
  }
}
