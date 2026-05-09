export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { samScrapeSchema } from '@/lib/leads/schemas'
import { buildSourceFamilyFilters } from '@/lib/leads/source-keys'
import { searchSamOpportunities } from '@/lib/leads/connectors/sam'
import { ingestNormalizedLeads } from '@/lib/leads/service'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  if (!['1', 'true', 'yes', 'on'].includes((process.env.LEADS_ENABLE_SAM || '').toLowerCase())) {
    return NextResponse.json(
      {
        error: 'SAM.gov matching is disabled in the current rollout.',
        configuredProviders: {
          samGov: Boolean(process.env.SAM_GOV_API_KEY),
        },
      },
      { status: 503 }
    )
  }

  const parsed = samScrapeSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data: businessLeads } = await admin
      .from('leads')
      .select('*')
      .or(
        buildSourceFamilyFilters('source', [
          'google_places_businesses',
          'outscraper_google_maps_businesses',
          'wisconsin_dfi_new_businesses',
          'apify_yelp_businesses',
        ])
      )
      .order('lead_score', { ascending: false })
      .limit(300)

    const result = await searchSamOpportunities({
      ...parsed.data,
      existingBusinessLeads: (businessLeads || []) as any,
    })

    const saved = result.matchedLeads.length
      ? await ingestNormalizedLeads(
          'sam_contract_opportunities',
          'sam_opportunity_match',
          parsed.data,
          result.matchedLeads,
          {
            sourceDefinition: {
              name: 'SAM.gov Opportunity Matching',
              category: 'government',
              sourceType: 'public_api',
              baseUrl: 'https://sam.gov',
              city: parsed.data.city || null,
              state: parsed.data.state || null,
              configJson: {
                keyword: parsed.data.keyword,
                naicsCodes: parsed.data.naicsCodes,
                daysBack: parsed.data.daysBack,
              },
            },
          }
        )
      : []

    return NextResponse.json({
      success: true,
      count: saved.length,
      opportunitiesCount: result.opportunities.length,
      leads: saved,
      unmatchedOpportunities: result.opportunities.length - saved.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SAM scrape failed.'
    return NextResponse.json(
      {
        error: message,
        configuredProviders: {
          samGov: Boolean(process.env.SAM_GOV_API_KEY),
        },
      },
      { status: /SAM_GOV_API_KEY/i.test(message) ? 503 : 500 }
    )
  }
}
