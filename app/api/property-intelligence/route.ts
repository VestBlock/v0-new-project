export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { listPublicPropertyOpportunities } from '@/lib/property-intelligence/repository'

export async function GET() {
  try {
    const result = await listPublicPropertyOpportunities(24)

    return NextResponse.json(
      { properties: result.properties, summary: result.summary },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (error) {
    console.error('[property-intelligence] public feed unavailable:', error)
    return NextResponse.json({
      properties: [],
      summary: null,
      error: 'Property intelligence is not available yet.',
    }, { status: 503 })
  }
}
