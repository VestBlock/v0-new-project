export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { isLegacyGooglePlacesPhaseOutEnabled } from '@/lib/leads/autopilot'
import { googlePlacesScrapeSchema } from '@/lib/leads/schemas'
import { searchGooglePlaces } from '@/lib/leads/connectors/google-places'
import { searchOutscraperGoogleMaps } from '@/lib/leads/connectors/outscraper-google-maps'
import { ingestNormalizedLeads } from '@/lib/leads/service'

function slugifyPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function resolveProvider(provider: 'auto' | 'google' | 'outscraper') {
  if (provider === 'google') {
    if (isLegacyGooglePlacesPhaseOutEnabled()) {
      throw new Error('Google Places scraping is paused during the current phase-out. Use Outscraper instead.')
    }
    return provider
  }
  if (provider === 'outscraper') return provider
  if (process.env.OUTSCRAPER_API_KEY) return 'outscraper'
  if (process.env.GOOGLE_PLACES_API_KEY && !isLegacyGooglePlacesPhaseOutEnabled()) return 'google'
  throw new Error('No maps provider is configured. Add OUTSCRAPER_API_KEY or GOOGLE_PLACES_API_KEY.')
}

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = googlePlacesScrapeSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const provider = resolveProvider(parsed.data.provider)
    const leads =
      provider === 'outscraper'
        ? await searchOutscraperGoogleMaps(parsed.data)
        : await searchGooglePlaces(parsed.data)
    const sourceKey =
      provider === 'outscraper' ? 'outscraper_google_maps_businesses' : 'google_places_businesses'
    const scopedSourceKey = `${sourceKey}__${slugifyPart(parsed.data.city)}_${slugifyPart(parsed.data.state || parsed.data.region || 'us')}`
    const saved = await ingestNormalizedLeads(
      scopedSourceKey,
      `${provider}_maps_scrape`,
      parsed.data,
      leads,
      {
        sourceDefinition: {
          name: `${provider === 'outscraper' ? 'Outscraper Maps' : 'Google Places'} (${parsed.data.city}${parsed.data.state ? `, ${parsed.data.state}` : ''})`,
          category: 'business',
          sourceType: provider === 'outscraper' ? 'provider_api' : 'api',
          baseUrl: provider === 'outscraper' ? 'https://app.outscraper.com' : 'https://maps.googleapis.com',
          city: parsed.data.city,
          state: parsed.data.state || null,
          configJson: {
            provider,
            language: parsed.data.language,
            region: parsed.data.region || null,
            niches: parsed.data.niches,
          },
        },
      }
    )
    return NextResponse.json({ success: true, provider, count: saved.length, leads: saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scrape failed.'
    const missingProvider =
      /OUTSCRAPER_API_KEY|GOOGLE_PLACES_API_KEY|No maps provider is configured|Google Places API key is invalid|API_KEY_INVALID|API key not valid|phase-out|Outscraper/i.test(message)
    return NextResponse.json(
      {
        error: message,
        configuredProviders: {
          google: Boolean(process.env.GOOGLE_PLACES_API_KEY),
          outscraper: Boolean(process.env.OUTSCRAPER_API_KEY),
        },
      },
      { status: missingProvider ? 503 : 500 }
    )
  }
}
