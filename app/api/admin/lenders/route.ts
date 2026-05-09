export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { updateLenderSchema } from '@/lib/lenders/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertLenderRelationshipEvent, updateLenderRecord } from '@/lib/lenders/repository'
import { logEvent } from '@/lib/system/logEvent'

function hasUsableEmail(row: { contact_email?: string | null; outreach_status?: string | null; relationship_stage?: string | null }) {
  const email = typeof row.contact_email === 'string' ? row.contact_email.trim() : ''
  if (!email) return false
  if (row.outreach_status === 'do_not_contact') return false
  if (row.relationship_stage === 'not_a_fit') return false
  return true
}

export async function GET(request: NextRequest) {
  try {
    const { admin, response } = await requireLeadAdmin(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const lenderType = searchParams.get('lender_type')
    const category = searchParams.get('category')
    const relationshipStage = searchParams.get('relationship_stage')
    const outreachStatus = searchParams.get('outreach_status')
    const state = searchParams.get('state')
    const search = searchParams.get('search')
    const spanishSupport = searchParams.get('spanish_support')
    const emailPriority = searchParams.get('email_priority') === 'only' ? 'only' : searchParams.get('email_priority') === 'prioritize' ? 'prioritize' : 'all'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = (page - 1) * limit

    let query = admin.from('lenders').select('*', { count: 'exact' })
    if (lenderType && lenderType !== 'all') query = query.eq('lender_type', lenderType)
    if (category && category !== 'all') query = query.eq('category', category)
    if (relationshipStage && relationshipStage !== 'all') query = query.eq('relationship_stage', relationshipStage)
    if (outreachStatus && outreachStatus !== 'all') query = query.eq('outreach_status', outreachStatus)
    if (state && state !== 'all') query = query.or(`headquarters_state.eq.${state},states_served.cs.{${state}}`)
    if (spanishSupport === 'true') query = query.eq('spanish_support', true)
    if (emailPriority === 'only') query = query.not('contact_email', 'is', null).neq('contact_email', '')
    if (search) {
      const cleaned = search.replace(/[,%()]/g, ' ').trim()
      if (cleaned) {
        query = query.or(
          [
            `name.ilike.%${cleaned}%`,
            `contact_email.ilike.%${cleaned}%`,
            `contact_phone.ilike.%${cleaned}%`,
            `website.ilike.%${cleaned}%`,
            `headquarters_city.ilike.%${cleaned}%`,
            `headquarters_state.ilike.%${cleaned}%`,
          ].join(',')
        )
      }
    }

    if (emailPriority === 'prioritize' || emailPriority === 'only') {
      query = query.order('contact_email', { ascending: false, nullsFirst: false }).order('confidence_score', { ascending: false }).order('updated_at', { ascending: false })
    } else {
      query = query.order('confidence_score', { ascending: false }).order('updated_at', { ascending: false })
    }

    const [{ data, error, count }, { data: summaryRows }] = await Promise.all([
      query.range(offset, offset + limit - 1),
      admin
        .from('lenders')
        .select('relationship_stage,outreach_status,confidence_score,category,contact_email,spanish_support,updated_at')
        .order('updated_at', { ascending: false })
        .limit(1000),
    ])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const summary = {
      total: count || 0,
      emailReady: (summaryRows || []).filter((row) => hasUsableEmail(row)).length,
      outreachReady: (summaryRows || []).filter((row) => row.outreach_status === 'needs_review' || row.outreach_status === 'approved').length,
      activePartners: (summaryRows || []).filter((row) => row.relationship_stage === 'active_partner').length,
      responded: (summaryRows || []).filter((row) => row.relationship_stage === 'responded').length,
      spanishReady: (summaryRows || []).filter((row) => row.spanish_support).length,
      averageConfidence:
        summaryRows && summaryRows.length
          ? Math.round(summaryRows.reduce((sum, row) => sum + Number(row.confidence_score || 0), 0) / summaryRows.length)
          : 0,
      categories: Object.entries(
        (summaryRows || []).reduce<Record<string, number>>((acc, row) => {
          const key = row.category || 'Unassigned'
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {})
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, value]) => ({ label, value })),
    }

    return NextResponse.json({
      lenders: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      summary,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch lenders.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { admin, user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const id = payload.id as string | undefined
  const parsed = updateLenderSchema.safeParse(payload)
  if (!id || !parsed.success) {
    return NextResponse.json({ error: parsed.success ? 'Lender id is required.' : parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { data: existingLender, error: existingError } = await admin
      .from('lenders')
      .select('metadata_json')
      .eq('id', id)
      .single()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    const updates: Record<string, unknown> = {
      relationship_stage: parsed.data.relationshipStage,
      outreach_status: parsed.data.outreachStatus,
      notes: parsed.data.notes,
      fit_summary: parsed.data.fitSummary,
      owner_user_id: parsed.data.ownerUserId,
      next_follow_up_at: parsed.data.nextFollowUpAt,
      contact_name: parsed.data.contactName,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone,
      states_served: parsed.data.statesServed,
      min_credit_score: parsed.data.minCreditScore,
      min_revenue: parsed.data.minRevenue,
      min_time_in_business: parsed.data.minTimeInBusiness,
      loan_amount_min: parsed.data.loanAmountMin,
      loan_amount_max: parsed.data.loanAmountMax,
      dscr_min: parsed.data.dscrMin,
      speed_to_close: parsed.data.speedToClose,
      startup_allowed: parsed.data.startupAllowed,
      investor_allowed: parsed.data.investorAllowed,
      owner_occupied_allowed: parsed.data.ownerOccupiedAllowed,
      low_doc: parsed.data.lowDoc,
      cash_out_allowed: parsed.data.cashOutAllowed,
      bilingual_support: parsed.data.bilingualSupport,
      spanish_support: parsed.data.spanishSupport,
    }

    const existingMetadata =
      existingLender?.metadata_json && typeof existingLender.metadata_json === 'object'
        ? (existingLender.metadata_json as Record<string, unknown>)
        : {}

    if (parsed.data.partnerProfile) {
      updates.metadata_json = {
        ...existingMetadata,
        partnerProfile: {
          ...(existingMetadata.partnerProfile && typeof existingMetadata.partnerProfile === 'object'
            ? (existingMetadata.partnerProfile as Record<string, unknown>)
            : {}),
          ...parsed.data.partnerProfile,
        },
      }
    }

    const lender = await updateLenderRecord(
      id,
      Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined))
    )

    await insertLenderRelationshipEvent({
      lenderId: id,
      actorUserId: user?.id,
      eventType: 'partner_profile_updated',
      metadata: {
        updatedFields: Object.keys(updates).filter((key) => updates[key] !== undefined),
      },
    })

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'lender',
      entityId: id,
      metadata: { action: 'lender_updated' },
    })

    return NextResponse.json({ success: true, lender })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update lender.' }, { status: 500 })
  }
}
