export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import type { TargetMarketRecord, TargetMarketStatus } from '@/lib/leads/types'

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    )
  }

  if (typeof value === 'string') {
    return Array.from(
      new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    )
  }

  return []
}

function estimateManualMarketScore(population: number | null, niches: string[]) {
  const populationBoost =
    population && population >= 1000000
      ? 14
      : population && population >= 500000
        ? 10
        : population && population >= 200000
          ? 7
          : population && population >= 75000
            ? 4
            : 2
  const nicheBoost = Math.min(niches.length * 3, 12)
  const spanishBoost = niches.some((niche) => /spanish|hispanic|latino/i.test(niche)) ? 4 : 0
  const realEstateBoost = niches.some((niche) => /real estate|investor|seller|property/i.test(niche)) ? 4 : 0
  return 58 + populationBoost + nicheBoost + spanishBoost + realEstateBoost
}

function normalizeStatus(value: unknown): TargetMarketStatus {
  const status = String(value || 'queued').trim()
  if (status === 'active' || status === 'scraped' || status === 'paused' || status === 'exhausted') {
    return status
  }
  return 'queued'
}

export async function GET(request: NextRequest) {
  const { admin, response } = await requireLeadAdmin(request)
  if (response) return response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Number(searchParams.get('limit') || '100')

  let query = admin
    .from('target_markets')
    .select('*')
    .order('final_score', { ascending: false })
    .limit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 250) : 100)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message || 'Unable to load markets.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, markets: (data || []) as TargetMarketRecord[] })
}

export async function POST(request: NextRequest) {
  const { admin, user, response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const body = (await request.json()) as Record<string, unknown>
    const city = String(body.city || '').trim()
    const state = String(body.state || '').trim().toUpperCase()
    const metroArea = String(body.metro_area || body.metroArea || '').trim() || null
    const niches = normalizeStringArray(body.niche_focus || body.niches)
    const populationRaw = Number(body.population)
    const population = Number.isFinite(populationRaw) && populationRaw > 0 ? Math.round(populationRaw) : null
    const status = normalizeStatus(body.status)

    if (!city || !state) {
      return NextResponse.json({ error: 'City and state are required.' }, { status: 400 })
    }

    if (!niches.length) {
      return NextResponse.json({ error: 'Add at least one target vertical or niche.' }, { status: 400 })
    }

    const finalScoreRaw = Number(body.final_score)
    const finalScore =
      Number.isFinite(finalScoreRaw) && finalScoreRaw > 0
        ? Math.round(finalScoreRaw)
        : estimateManualMarketScore(population, niches)

    const now = new Date().toISOString()
    const payload = {
      city,
      state,
      metro_area: metroArea,
      population,
      niche_focus: niches,
      status,
      final_score: finalScore,
      performance_json: {
        manualOverride: true,
        operatorAddedAt: now,
        operatorAddedBy: user?.email || user?.id || 'admin',
      },
      updated_at: now,
    }

    const { data, error } = await admin
      .from('target_markets')
      .upsert(payload, { onConflict: 'city,state' })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Unable to save market.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, market: data as TargetMarketRecord })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save market.' },
      { status: 500 }
    )
  }
}
