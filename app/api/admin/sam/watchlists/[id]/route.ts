export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { deleteSamWatchlist, updateSamWatchlist } from '@/lib/sam/repository'
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

  return undefined
}

function normalizeBody(body: Record<string, unknown>): Partial<SamWatchlistMutationInput> {
  return {
    ...(body.label !== undefined ? { label: String(body.label || '').trim() } : {}),
    ...(body.status !== undefined ? { status: body.status as SamWatchlistRecord['status'] } : {}),
    ...(body.watch_type !== undefined ? { watch_type: body.watch_type as SamWatchlistRecord['watch_type'] } : {}),
    ...(body.owner_user_id !== undefined ? { owner_user_id: body.owner_user_id ? String(body.owner_user_id) : null } : {}),
    ...(body.lead_id !== undefined ? { lead_id: body.lead_id ? String(body.lead_id) : null } : {}),
    ...(body.user_email !== undefined ? { user_email: body.user_email ? String(body.user_email).trim() : null } : {}),
    ...(body.company_name !== undefined ? { company_name: body.company_name ? String(body.company_name).trim() : null } : {}),
    ...(body.keywords !== undefined ? { keywords: normalizeStringArray(body.keywords) } : {}),
    ...(body.naics_codes !== undefined ? { naics_codes: normalizeStringArray(body.naics_codes) } : {}),
    ...(body.solicitation_types !== undefined ? { solicitation_types: normalizeStringArray(body.solicitation_types) } : {}),
    ...(body.set_asides !== undefined ? { set_asides: normalizeStringArray(body.set_asides) } : {}),
    ...(body.agency_codes !== undefined ? { agency_codes: normalizeStringArray(body.agency_codes) } : {}),
    ...(body.organization_codes !== undefined ? { organization_codes: normalizeStringArray(body.organization_codes) } : {}),
    ...(body.applicant_types !== undefined ? { applicant_types: normalizeStringArray(body.applicant_types) } : {}),
    ...(body.beneficiary_types !== undefined ? { beneficiary_types: normalizeStringArray(body.beneficiary_types) } : {}),
    ...(body.assistance_types !== undefined ? { assistance_types: normalizeStringArray(body.assistance_types) } : {}),
    ...(body.states !== undefined
      ? { states: (normalizeStringArray(body.states) || []).map((item) => item.toUpperCase()) }
      : {}),
    ...(body.zip_codes !== undefined ? { zip_codes: normalizeStringArray(body.zip_codes) } : {}),
    ...(body.response_deadline_days !== undefined
      ? {
          response_deadline_days:
            body.response_deadline_days === '' || body.response_deadline_days === null
              ? null
              : Number(body.response_deadline_days),
        }
      : {}),
    ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
    ...(body.metadata_json !== undefined && typeof body.metadata_json === 'object'
      ? { metadata_json: body.metadata_json as Record<string, unknown> }
      : {}),
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const { id } = await params
    const body = (await request.json()) as Record<string, unknown>
    const watchlist = await updateSamWatchlist(id, normalizeBody(body))
    return NextResponse.json({ success: true, watchlist })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update SAM watchlist.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const { id } = await params
    await deleteSamWatchlist(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to delete SAM watchlist.' },
      { status: 500 }
    )
  }
}
