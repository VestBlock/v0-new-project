export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { searchWisconsinBusinesses } from '@/lib/leads/connectors/wisconsin-dfi'
import { newBusinessScrapeSchema } from '@/lib/leads/schemas'
import { ingestNormalizedLeads } from '@/lib/leads/service'

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = newBusinessScrapeSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const leads = await searchWisconsinBusinesses(parsed.data)
    const saved = await ingestNormalizedLeads(
      'wisconsin_dfi_new_businesses',
      'new_business_scrape',
      parsed.data,
      leads,
      {
        sourceDefinition: {
          name: 'Wisconsin DFI New Businesses',
          category: 'business',
          sourceType: 'public_filing',
          baseUrl: 'https://data.wi.gov',
          city: null,
          state: 'WI',
          configJson: {
            query: parsed.data.query,
            daysBack: parsed.data.daysBack,
          },
        },
      }
    )
    return NextResponse.json({ success: true, count: saved.length, leads: saved })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scrape failed.' },
      { status: 500 }
    )
  }
}
