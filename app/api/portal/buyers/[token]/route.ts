export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { replaceBuyerBuyBoxes } from '@/lib/buyers/repository'
import { getBuyerPortalPayload, saveBuyerPortalProfile, updateBuyerPortalMatchStatus } from '@/lib/partners/portal'

const profileSchema = z.object({
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().max(320).nullable().optional(),
  contactPhone: z.string().max(60).nullable().optional(),
  marketsServed: z.array(z.string().min(2).max(120)).max(120).optional(),
  closingSpeed: z.string().max(120).nullable().optional(),
  proofOfFundsStatus: z.string().max(200).nullable().optional(),
  fitSummary: z.string().max(2000).nullable().optional(),
  bilingualSupport: z.boolean().optional(),
  spanishSupport: z.boolean().optional(),
  partnerProfile: z.object({
    buyBoxName: z.string().max(200).nullable().optional(),
    assetTypes: z.array(z.string().min(1).max(120)).max(40).optional(),
    states: z.array(z.string().min(2).max(32)).max(60).optional(),
    cities: z.array(z.string().min(1).max(120)).max(120).optional(),
    zipCodes: z.array(z.string().min(1).max(20)).max(200).optional(),
    metros: z.array(z.string().min(1).max(120)).max(120).optional(),
    occupancyPreference: z.string().max(120).nullable().optional(),
    distressedTolerance: z.number().min(0).max(10).nullable().optional(),
    codeViolationTolerance: z.number().min(0).max(10).nullable().optional(),
    tenantOccupiedAllowed: z.boolean().optional(),
    section8Allowed: z.boolean().optional(),
    priceMin: z.number().min(0).max(100_000_000).nullable().optional(),
    priceMax: z.number().min(0).max(100_000_000).nullable().optional(),
    arvMin: z.number().min(0).max(100_000_000).nullable().optional(),
    arvMax: z.number().min(0).max(100_000_000).nullable().optional(),
    rehabBudgetMax: z.number().min(0).max(100_000_000).nullable().optional(),
    minimumEquityPercent: z.number().min(0).max(100).nullable().optional(),
    minimumDiscountPercent: z.number().min(0).max(100).nullable().optional(),
    preferredDealTypes: z.array(z.string().min(1).max(120)).max(30).optional(),
    creativeFinanceOpen: z.boolean().optional(),
    portfolioSizePreference: z.string().max(200).nullable().optional(),
    institutionalCriteria: z.string().max(2000).nullable().optional(),
    acquisitionProcessOwner: z.string().max(300).nullable().optional(),
    referralProgramStatus: z.string().max(500).nullable().optional(),
    referralCompensationNotes: z.string().max(1000).nullable().optional(),
    buyBoxNotes: z.string().max(2000).nullable().optional(),
  }),
})

const matchActionSchema = z.object({
  matchId: z.string().uuid(),
  status: z.enum(['reviewed', 'active', 'rejected', 'archived']),
  note: z.string().max(1500).nullable().optional(),
})

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  try {
    const data = await getBuyerPortalPayload(token)
    if (!data) {
      return NextResponse.json({ error: 'Portal invite not found.' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load buyer portal.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = await request.json().catch(() => ({}))
  const parsed = profileSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const portal = await getBuyerPortalPayload(token)
  if (!portal) {
    return NextResponse.json({ error: 'Portal invite not found.' }, { status: 404 })
  }

  try {
    const buyer = await saveBuyerPortalProfile({
      access: portal.access,
      buyer: portal.buyer,
      updates: {
        contact_name: parsed.data.contactName,
        contact_email: parsed.data.contactEmail,
        contact_phone: parsed.data.contactPhone,
        markets_served: parsed.data.marketsServed,
        closing_speed: parsed.data.closingSpeed,
        proof_of_funds_status: parsed.data.proofOfFundsStatus,
        fit_summary: parsed.data.fitSummary,
        bilingual_support: parsed.data.bilingualSupport,
        spanish_support: parsed.data.spanishSupport,
      },
      buyBox: parsed.data.partnerProfile,
    })

    await replaceBuyerBuyBoxes(portal.buyer.id, [
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

    return NextResponse.json({ success: true, buyer })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save buyer profile.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = await request.json().catch(() => ({}))
  const parsed = matchActionSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const portal = await getBuyerPortalPayload(token)
  if (!portal) {
    return NextResponse.json({ error: 'Portal invite not found.' }, { status: 404 })
  }

  const match = portal.matches.find((row) => row.id === parsed.data.matchId)
  if (!match) {
    return NextResponse.json({ error: 'Property opportunity not found.' }, { status: 404 })
  }

  try {
    const updated = await updateBuyerPortalMatchStatus({
      access: portal.access,
      buyer: portal.buyer,
      match,
      status: parsed.data.status,
      note: parsed.data.note || null,
    })

    return NextResponse.json({ success: true, match: updated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update property opportunity.' },
      { status: 500 }
    )
  }
}
