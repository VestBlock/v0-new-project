export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { codeViolationScrapeSchema } from '@/lib/leads/schemas'
import { searchCincinnatiCodeViolations } from '@/lib/leads/connectors/cincinnati-code-enforcement'
import { searchMilwaukeeAccela } from '@/lib/leads/connectors/milwaukee-accela'
import { ingestNormalizedLeads } from '@/lib/leads/service'

function normalizeCity(value?: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function normalizeState(value?: string) {
  return String(value || '')
    .trim()
    .toUpperCase()
}

function slugifyPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function scopedSourceKey(base: string, city: string, state: string) {
  return `${base}__${slugifyPart(city)}_${slugifyPart(state)}`
}

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const parsed = codeViolationScrapeSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const city = normalizeCity(parsed.data.city)
    const state = normalizeState(parsed.data.state)
    const wantsMilwaukee = city === 'milwaukee' || state === 'WI'
    const wantsCincinnati = city === 'cincinnati' || state === 'OH'
    const hasMarketInput = Boolean(city || state)
    const wantsOnlyMilwaukee = parsed.data.provider === 'milwaukee'
    const wantsOnlyCincinnati = parsed.data.provider === 'cincinnati'
    const canRunMilwaukee = Boolean(parsed.data.street?.trim() || parsed.data.zip?.trim())

    if (wantsOnlyMilwaukee && hasMarketInput && (city && city !== 'milwaukee' || state && state !== 'WI')) {
      return NextResponse.json(
        { error: 'Milwaukee Accela only supports Milwaukee, WI. Use the Milwaukee source with a Milwaukee street or zip.' },
        { status: 400 }
      )
    }

    if (wantsOnlyCincinnati && hasMarketInput && (city && city !== 'cincinnati' || state && state !== 'OH')) {
      return NextResponse.json(
        { error: 'Cincinnati code enforcement only supports Cincinnati, OH.' },
        { status: 400 }
      )
    }

    if (!wantsOnlyMilwaukee && !wantsOnlyCincinnati && hasMarketInput && !wantsMilwaukee && !wantsCincinnati) {
      return NextResponse.json(
        { error: 'Code violation scraping currently supports Cincinnati, OH and Milwaukee, WI only.' },
        { status: 400 }
      )
    }

    if (wantsOnlyMilwaukee && !canRunMilwaukee) {
      return NextResponse.json(
        { error: 'Milwaukee enforcement search is address-driven. Add a street or zip before running that source.' },
        { status: 400 }
      )
    }

    const runCincinnati =
      wantsOnlyCincinnati ||
      (!wantsOnlyMilwaukee && (wantsCincinnati || !hasMarketInput))
    const runMilwaukee =
      wantsOnlyMilwaukee ||
      (!wantsOnlyCincinnati && wantsMilwaukee && canRunMilwaukee) ||
      (!wantsOnlyCincinnati && !hasMarketInput && canRunMilwaukee)

    const cincinnati = runCincinnati
      ? await searchCincinnatiCodeViolations({
          limit: parsed.data.limit,
          daysBack: parsed.data.daysBack,
        })
      : []

    const milwaukee = runMilwaukee
      ? await searchMilwaukeeAccela({
          street: parsed.data.street,
          city: 'Milwaukee',
          state: 'WI',
          zip: parsed.data.zip,
          limit: parsed.data.limit,
        })
      : []

    const warnings: string[] = []
    if (!runMilwaukee && !wantsOnlyCincinnati && (wantsMilwaukee || !hasMarketInput)) {
      warnings.push('Milwaukee Accela was skipped because that source needs a Milwaukee street or zip seed to avoid sloppy results.')
    }
    if (!runCincinnati && !runMilwaukee) {
      return NextResponse.json(
        { error: 'No supported code-violation source was eligible to run with the current inputs.' },
        { status: 400 }
      )
    }

    const savedCincinnati = cincinnati.length
      ? await ingestNormalizedLeads(
          scopedSourceKey('cincinnati_code_enforcement', 'Cincinnati', 'OH'),
          'code_violation_scrape',
          parsed.data,
          cincinnati,
          {
            sourceDefinition: {
              name: 'Cincinnati Code Enforcement (Cincinnati, OH)',
              category: 'real_estate',
              sourceType: 'open_data',
              baseUrl: 'https://data.cincinnati-oh.gov',
              city: 'Cincinnati',
              state: 'OH',
              configJson: {
                provider: 'cincinnati',
                daysBack: parsed.data.daysBack,
              },
            },
          }
        )
      : []

    const savedMilwaukee = milwaukee.length
      ? await ingestNormalizedLeads(
          scopedSourceKey('milwaukee_accela_enforcement', 'Milwaukee', 'WI'),
          'code_violation_scrape',
          parsed.data,
          milwaukee,
          {
            sourceDefinition: {
              name: 'Milwaukee Accela Enforcement (Milwaukee, WI)',
              category: 'real_estate',
              sourceType: 'public_search',
              baseUrl: 'https://aca-prod.accela.com/MILWAUKEE/Cap/CapHome.aspx?module=Enforcement&TabName=Enforcement',
              city: 'Milwaukee',
              state: 'WI',
              configJson: {
                provider: 'milwaukee',
                street: parsed.data.street || null,
                zip: parsed.data.zip || null,
              },
            },
          }
        )
      : []

    return NextResponse.json({
      success: true,
      count: savedCincinnati.length + savedMilwaukee.length,
      leads: [...savedCincinnati, ...savedMilwaukee],
      warnings,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scrape failed.' },
      { status: 500 }
    )
  }
}
