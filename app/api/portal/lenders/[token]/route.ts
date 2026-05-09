export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLenderPortalPayload, saveLenderPortalProfile, updateLenderPortalMatchStatus } from '@/lib/partners/portal'

const profileSchema = z.object({
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().max(320).nullable().optional(),
  contactPhone: z.string().max(60).nullable().optional(),
  statesServed: z.array(z.string().min(2).max(32)).max(80).optional(),
  fitSummary: z.string().max(2000).nullable().optional(),
  minCreditScore: z.number().int().min(300).max(850).nullable().optional(),
  minRevenue: z.number().min(0).max(1_000_000_000).nullable().optional(),
  minTimeInBusiness: z.number().int().min(0).max(2400).nullable().optional(),
  loanAmountMin: z.number().min(0).max(1_000_000_000).nullable().optional(),
  loanAmountMax: z.number().min(0).max(1_000_000_000).nullable().optional(),
  dscrMin: z.number().min(0).max(10).nullable().optional(),
  speedToClose: z.string().max(120).nullable().optional(),
  startupAllowed: z.boolean().optional(),
  investorAllowed: z.boolean().optional(),
  ownerOccupiedAllowed: z.boolean().optional(),
  lowDoc: z.boolean().optional(),
  cashOutAllowed: z.boolean().optional(),
  bilingualSupport: z.boolean().optional(),
  spanishSupport: z.boolean().optional(),
  partnerProfile: z
    .object({
      preferredBorrowers: z.string().max(2000).nullable().optional(),
      noGoItems: z.string().max(2000).nullable().optional(),
      submissionNotes: z.string().max(2000).nullable().optional(),
      partnerProcessOwner: z.string().max(300).nullable().optional(),
      referralProgramStatus: z.string().max(500).nullable().optional(),
      referralCompensationNotes: z.string().max(1000).nullable().optional(),
    })
    .optional(),
})

const matchActionSchema = z.object({
  matchId: z.string().uuid(),
  status: z.enum(['reviewed', 'active', 'rejected', 'archived']),
  note: z.string().max(1500).nullable().optional(),
})

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  try {
    const data = await getLenderPortalPayload(token)
    if (!data) {
      return NextResponse.json({ error: 'Portal invite not found.' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load lender portal.' },
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

  const portal = await getLenderPortalPayload(token)
  if (!portal) {
    return NextResponse.json({ error: 'Portal invite not found.' }, { status: 404 })
  }

  try {
    const lender = await saveLenderPortalProfile({
      access: portal.access,
      lender: portal.lender,
      updates: {
        contact_name: parsed.data.contactName,
        contact_email: parsed.data.contactEmail,
        contact_phone: parsed.data.contactPhone,
        states_served: parsed.data.statesServed,
        fit_summary: parsed.data.fitSummary,
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
      },
      partnerProfile: parsed.data.partnerProfile,
    })

    return NextResponse.json({ success: true, lender })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to save partner profile.' },
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

  const portal = await getLenderPortalPayload(token)
  if (!portal) {
    return NextResponse.json({ error: 'Portal invite not found.' }, { status: 404 })
  }

  const match = portal.matches.find((row) => row.id === parsed.data.matchId)
  if (!match) {
    return NextResponse.json({ error: 'Borrower opportunity not found.' }, { status: 404 })
  }

  try {
    const updated = await updateLenderPortalMatchStatus({
      access: portal.access,
      lender: portal.lender,
      match,
      status: parsed.data.status,
      note: parsed.data.note || null,
    })

    return NextResponse.json({ success: true, match: updated })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update borrower opportunity.' },
      { status: 500 }
    )
  }
}
