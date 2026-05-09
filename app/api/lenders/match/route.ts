export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { lenderMatchRequestSchema } from '@/lib/lenders/schemas'
import { persistBorrowerLenderMatches } from '@/lib/lenders/service'
import { requireFundingUser } from '@/lib/funding/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLatestFundingProfile, getLatestFundingRecommendation } from '@/lib/funding/repository'

export async function GET() {
  const { user, response } = await requireFundingUser()
  if (response || !user) return response

  const admin = createAdminClient()
  const [profile, recommendation] = await Promise.all([
    getLatestFundingProfile(admin, user.id),
    getLatestFundingRecommendation(admin, user.id),
  ])

  const matches = await persistBorrowerLenderMatches({
    userId: user.id,
    fundingProfileId: profile?.id,
    fundingRecommendationId: recommendation?.id,
    serviceType: recommendation?.recommended_path || 'Funding Prep Plan',
    mode: profile?.mode,
    borrowerState: null,
    businessIndustry: profile?.business_industry || null,
    businessRevenue: profile?.business_revenue_range ? null : null,
    timeInBusinessMonths: profile?.business_start_date
      ? Math.max(0, Math.round((Date.now() - Date.parse(profile.business_start_date)) / (30 * 24 * 60 * 60 * 1000)))
      : null,
    ficoEstimate: profile?.fico_estimate || null,
    fundingGoalAmount: profile?.funding_goal_amount || null,
    languagePreference: 'en',
  })

  return NextResponse.json({ matches })
}

export async function POST(request: Request) {
  const { user, response } = await requireFundingUser()
  if (response || !user) return response

  const parsed = lenderMatchRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const matches = await persistBorrowerLenderMatches({
    ...parsed.data,
    userId: parsed.data.userId || user.id,
  })

  return NextResponse.json({ matches })
}
