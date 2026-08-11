export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { listPropertyIntelligence } from '@/lib/property-intelligence/repository'

export async function GET() {
  try {
    const result = await listPropertyIntelligence({ minScore: 55, limit: 100 })
    const properties = result.properties.map((property) => ({
      id: property.id,
      property_address: property.property_address,
      city: property.city,
      state: property.state,
      zip_code: property.zip_code,
      latitude: property.latitude,
      longitude: property.longitude,
      is_vacant_lot: property.is_vacant_lot,
      vacant_lot_confidence: property.vacant_lot_confidence,
      property_signals: (property.property_signals || []).map((signal) => ({
        signal_type: signal.signal_type,
        signal_label: signal.signal_label,
        confidence_score: signal.confidence_score,
      })),
      deal_scores: (property.deal_scores || []).map((score) => ({
        score: score.score,
        reason_codes: score.reason_codes,
        explanation: score.explanation,
        recommended_next_action: score.recommended_next_action,
      })),
      owners: null,
    }))

    return NextResponse.json({ properties, summary: result.summary })
  } catch (error) {
    return NextResponse.json({
      properties: [],
      summary: null,
      error: error instanceof Error ? error.message : 'Property intelligence is not available yet.',
    })
  }
}
