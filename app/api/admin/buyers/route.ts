export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { updateBuyerSchema } from '@/lib/buyers/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertBuyerRelationshipEvent, replaceBuyerBuyBoxes, updateBuyerRecord } from '@/lib/buyers/repository'
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
    const buyerType = searchParams.get('buyer_type')
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

    let query = admin.from('buyers').select('*', { count: 'exact' })
    if (buyerType && buyerType !== 'all') query = query.eq('buyer_type', buyerType)
    if (category && category !== 'all') query = query.eq('category', category)
    if (relationshipStage && relationshipStage !== 'all') query = query.eq('relationship_stage', relationshipStage)
    if (outreachStatus && outreachStatus !== 'all') query = query.eq('outreach_status', outreachStatus)
    if (state && state !== 'all') query = query.or(`headquarters_state.eq.${state},markets_served.cs.{${state}}`)
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
        .from('buyers')
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
      activePartners: (summaryRows || []).filter((row) => row.relationship_stage === 'active_buyer').length,
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
      buyers: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      summary,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch buyers.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { admin, user, response } = await requireLeadAdmin(request)
  if (response) return response

  const payload = await request.json().catch(() => ({}))
  const id = payload.id as string | undefined
  const parsed = updateBuyerSchema.safeParse(payload)
  if (!id || !parsed.success) {
    return NextResponse.json({ error: parsed.success ? 'Buyer id is required.' : parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { data: existingBuyer, error: existingError } = await admin
      .from('buyers')
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
      markets_served: parsed.data.marketsServed,
      closing_speed: parsed.data.closingSpeed,
      proof_of_funds_status: parsed.data.proofOfFundsStatus,
      bilingual_support: parsed.data.bilingualSupport,
      spanish_support: parsed.data.spanishSupport,
    }

    const existingMetadata =
      existingBuyer?.metadata_json && typeof existingBuyer.metadata_json === 'object'
        ? (existingBuyer.metadata_json as Record<string, unknown>)
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

    const buyer = await updateBuyerRecord(
      id,
      Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined))
    )

    if (parsed.data.partnerProfile) {
      await replaceBuyerBuyBoxes(id, [
        {
          buy_box_name: parsed.data.partnerProfile.buyBoxName || 'Primary buy box',
          asset_types: parsed.data.partnerProfile.assetTypes || [],
          states: parsed.data.partnerProfile.states || [],
          cities: parsed.data.partnerProfile.cities || [],
          zip_codes: parsed.data.partnerProfile.zipCodes || [],
          metros: parsed.data.partnerProfile.metros || [],
          occupancy_preference: parsed.data.partnerProfile.occupancyPreference || null,
          distressed_tolerance: parsed.data.partnerProfile.distressedTolerance ?? 0,
          code_violation_tolerance: parsed.data.partnerProfile.codeViolationTolerance ?? 0,
          tenant_occupied_allowed: parsed.data.partnerProfile.tenantOccupiedAllowed ?? false,
          section8_allowed: parsed.data.partnerProfile.section8Allowed ?? false,
          price_min: parsed.data.partnerProfile.priceMin ?? null,
          price_max: parsed.data.partnerProfile.priceMax ?? null,
          arv_min: parsed.data.partnerProfile.arvMin ?? null,
          arv_max: parsed.data.partnerProfile.arvMax ?? null,
          rehab_budget_max: parsed.data.partnerProfile.rehabBudgetMax ?? null,
          minimum_equity_percent: parsed.data.partnerProfile.minimumEquityPercent ?? null,
          minimum_discount_percent: parsed.data.partnerProfile.minimumDiscountPercent ?? null,
          preferred_deal_types: parsed.data.partnerProfile.preferredDealTypes || [],
          closing_speed: parsed.data.closingSpeed || null,
          proof_of_funds_status: parsed.data.proofOfFundsStatus || null,
          creative_finance_open: parsed.data.partnerProfile.creativeFinanceOpen ?? false,
          portfolio_size_preference: parsed.data.partnerProfile.portfolioSizePreference || null,
          institutional_criteria: parsed.data.partnerProfile.institutionalCriteria || null,
          bilingual_support: parsed.data.bilingualSupport ?? buyer.bilingual_support,
          spanish_support: parsed.data.spanishSupport ?? buyer.spanish_support,
          active: true,
          notes: parsed.data.partnerProfile.buyBoxNotes || null,
          metadata_json: {
            acquisitionProcessOwner: parsed.data.partnerProfile.acquisitionProcessOwner || null,
            referralProgramStatus: parsed.data.partnerProfile.referralProgramStatus || null,
            referralCompensationNotes: parsed.data.partnerProfile.referralCompensationNotes || null,
          },
        },
      ])
    }

    await insertBuyerRelationshipEvent({
      buyerId: id,
      actorUserId: user?.id,
      eventType: 'partner_profile_updated',
      metadata: {
        updatedFields: Object.keys(updates).filter((key) => updates[key] !== undefined),
      },
    })

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'buyer',
      entityId: id,
      metadata: { action: 'buyer_updated' },
    })

    return NextResponse.json({ success: true, buyer })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update buyer.' }, { status: 500 })
  }
}
