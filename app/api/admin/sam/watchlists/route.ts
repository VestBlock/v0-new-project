export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { createSamWatchlist, listSamWatchlists } from '@/lib/sam/repository'
import type { SamWatchlistMutationInput, SamWatchlistRecord } from '@/lib/sam/types'

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

function normalizeBody(body: Record<string, unknown>): SamWatchlistMutationInput {
  return {
    label: String(body.label || '').trim(),
    status: (body.status as SamWatchlistRecord['status'] | undefined) || 'active',
    watch_type: (body.watch_type as SamWatchlistRecord['watch_type'] | undefined) || 'opportunity',
    owner_user_id: body.owner_user_id ? String(body.owner_user_id) : null,
    lead_id: body.lead_id ? String(body.lead_id) : null,
    user_email: body.user_email ? String(body.user_email).trim() : null,
    company_name: body.company_name ? String(body.company_name).trim() : null,
    keywords: normalizeStringArray(body.keywords),
    naics_codes: normalizeStringArray(body.naics_codes),
    solicitation_types: normalizeStringArray(body.solicitation_types),
    set_asides: normalizeStringArray(body.set_asides),
    agency_codes: normalizeStringArray(body.agency_codes),
    organization_codes: normalizeStringArray(body.organization_codes),
    applicant_types: normalizeStringArray(body.applicant_types),
    beneficiary_types: normalizeStringArray(body.beneficiary_types),
    assistance_types: normalizeStringArray(body.assistance_types),
    states: normalizeStringArray(body.states).map((item) => item.toUpperCase()),
    zip_codes: normalizeStringArray(body.zip_codes),
    response_deadline_days:
      body.response_deadline_days === '' || body.response_deadline_days === null || body.response_deadline_days === undefined
        ? null
        : Number(body.response_deadline_days),
    notes: body.notes ? String(body.notes) : null,
    metadata_json:
      body.metadata_json && typeof body.metadata_json === 'object'
        ? (body.metadata_json as Record<string, unknown>)
        : {},
  }
}

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const watchlists = await listSamWatchlists()
    return NextResponse.json({ success: true, watchlists })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load SAM watchlists.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const body = (await request.json()) as Record<string, unknown>
    const input = normalizeBody(body)
    if (!input.label) {
      return NextResponse.json({ error: 'Watchlist label is required.' }, { status: 400 })
    }

    const watchlist = await createSamWatchlist({
      ...input,
      owner_user_id: input.owner_user_id || user?.id || null,
      user_email: input.user_email || user?.email || null,
    })

    return NextResponse.json({ success: true, watchlist })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create SAM watchlist.' },
      { status: 500 }
    )
  }
}
