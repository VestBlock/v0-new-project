export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { listPropertyIntelligence } from '@/lib/property-intelligence/repository'

function num(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const { searchParams } = new URL(request.url)
  try {
    const result = await listPropertyIntelligence({
      search: searchParams.get('search'),
      city: searchParams.get('city'),
      state: searchParams.get('state'),
      zipCode: searchParams.get('zip'),
      signal: searchParams.get('signal') || 'all',
      vacantOnly: searchParams.get('vacant') === 'true',
      minScore: num(searchParams.get('min_score')),
      maxScore: num(searchParams.get('max_score')),
      minValue: num(searchParams.get('min_value')),
      maxValue: num(searchParams.get('max_value')),
      limit: num(searchParams.get('limit')) || 250,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load property intelligence.'
    return NextResponse.json({ error: message, properties: [], summary: null }, { status: 500 })
  }
}
