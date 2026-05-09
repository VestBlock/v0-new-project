export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { getSamDashboardSummary } from '@/lib/sam/repository'
import { runSamSmokeVerification } from '@/lib/sam/service'

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const [dashboard, verification] = await Promise.all([
      getSamDashboardSummary(),
      runSamSmokeVerification(),
    ])

    return NextResponse.json({
      success: true,
      dashboard,
      verification,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load SAM dashboard.' },
      { status: 500 }
    )
  }
}
