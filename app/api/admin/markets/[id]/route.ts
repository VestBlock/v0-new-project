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

function normalizeStatus(value: unknown): TargetMarketStatus | null {
  if (value === undefined) return null
  const status = String(value || '').trim()
  if (status === 'queued' || status === 'active' || status === 'scraped' || status === 'paused' || status === 'exhausted') {
    return status
  }
  return null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { admin, response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const { id } = await context.params
    const body = (await request.json()) as Record<string, unknown>

    const { data: current, error: currentError } = await admin
      .from('target_markets')
      .select('*')
      .eq('id', id)
      .single()

    if (currentError || !current) {
      return NextResponse.json({ error: 'Market not found.' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.city !== undefined) patch.city = String(body.city || '').trim()
    if (body.state !== undefined) patch.state = String(body.state || '').trim().toUpperCase()
    if (body.metro_area !== undefined || body.metroArea !== undefined) {
      patch.metro_area = String(body.metro_area || body.metroArea || '').trim() || null
    }
    if (body.population !== undefined) {
      const populationRaw = Number(body.population)
      patch.population = Number.isFinite(populationRaw) && populationRaw > 0 ? Math.round(populationRaw) : null
    }
    if (body.niche_focus !== undefined || body.niches !== undefined) {
      patch.niche_focus = normalizeStringArray(body.niche_focus || body.niches)
    }
    if (body.final_score !== undefined) {
      const finalScoreRaw = Number(body.final_score)
      if (Number.isFinite(finalScoreRaw)) patch.final_score = Math.round(finalScoreRaw)
    }

    const normalizedStatus = normalizeStatus(body.status)
    if (normalizedStatus) patch.status = normalizedStatus

    if (body.last_scraped_at !== undefined || body.lastScrapedAt !== undefined) {
      patch.last_scraped_at = body.last_scraped_at || body.lastScrapedAt || null
    }

    if (body.performance_json && typeof body.performance_json === 'object') {
      patch.performance_json = {
        ...(current.performance_json || {}),
        ...(body.performance_json as Record<string, unknown>),
      }
    }

    const { data, error } = await admin
      .from('target_markets')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Unable to update market.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, market: data as TargetMarketRecord })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update market.' },
      { status: 500 }
    )
  }
}
