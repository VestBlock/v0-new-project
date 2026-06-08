export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { runEntitySeoExpansion } from '@/lib/content/entitySeoExpansion'
import { isCronAuthorized } from '@/lib/system/cronAuth'

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const dryRun = ['1', 'true', 'yes'].includes(url.searchParams.get('dryRun')?.toLowerCase() || '')
    const proactiveCityEnabledParam = url.searchParams.get('proactiveCityEnabled')
    const proactiveCityLimitParam = Number.parseInt(url.searchParams.get('proactiveCityLimit') || '', 10)
    const result = await runEntitySeoExpansion({
      dryRun,
      proactiveCityEnabled: proactiveCityEnabledParam
        ? ['1', 'true', 'yes'].includes(proactiveCityEnabledParam.toLowerCase())
        : undefined,
      proactiveCityLimit: Number.isFinite(proactiveCityLimitParam) ? proactiveCityLimitParam : undefined,
    })
    return NextResponse.json({ success: true, dryRun, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Entity SEO expansion failed.' },
      { status: 500 }
    )
  }
}
