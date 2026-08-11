export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { LENDER_CATEGORY_TO_TYPE } from '@/lib/lenders/constants'
import { upsertLender, updateLenderRecord } from '@/lib/lenders/repository'
import type { LenderCategory } from '@/lib/lenders/types'

const lenderSignupSchema = z.object({
  companyName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(80).optional().default(''),
  website: z.string().trim().max(300).optional().default(''),
  category: z.enum(['private_lender', 'hard_money', 'dscr', 'fix_and_flip', 'bridge', 'commercial']),
  statesServed: z.string().trim().min(2).max(500),
  loanAmountMin: z.string().trim().max(80).optional().default(''),
  loanAmountMax: z.string().trim().max(80).optional().default(''),
  minCreditScore: z.string().trim().max(500).optional().default(''),
  speedToClose: z.string().trim().max(120).optional().default(''),
  preferredDeals: z.string().trim().min(5).max(2500),
  noGoItems: z.string().trim().max(2000).optional().default(''),
  referralNotes: z.string().trim().max(2000).optional().default(''),
})

function parseCurrency(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeWebsite(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function parseStates(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map((state) => state.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, 60)
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}))
    const parsed = lenderSignupSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Please complete the required lender signup fields.' }, { status: 400 })
    }

    const data = parsed.data
    const category = data.category as LenderCategory
    const statesServed = parseStates(data.statesServed)
    const loanAmountMin = parseCurrency(data.loanAmountMin)
    const loanAmountMax = parseCurrency(data.loanAmountMax)
    const website = normalizeWebsite(data.website)
    const nationalOrRegional =
      statesServed.length > 8 ? 'national' : statesServed.length > 1 ? 'multi_state' : 'local'

    const lender = await upsertLender({
      name: data.companyName,
      website,
      lenderType: LENDER_CATEGORY_TO_TYPE[category] || 'real_estate',
      category,
      statesServed,
      nationalOrRegional,
      contactEmail: data.email,
      contactPhone: data.phone || null,
      contactName: data.contactName,
      source: 'public_lender_signup',
      sourceUrl: '/lenders',
      fitSummary: data.preferredDeals,
      notes: [data.preferredDeals, data.noGoItems ? `No-go items: ${data.noGoItems}` : '', data.referralNotes ? `Referral notes: ${data.referralNotes}` : '']
        .filter(Boolean)
        .join('\n\n'),
      loanAmountMin,
      loanAmountMax,
      speedToClose: data.speedToClose || null,
      investorAllowed: true,
      ownerOccupiedAllowed: false,
      contactInfo: {
        contactName: data.contactName,
        email: data.email,
        phone: data.phone || null,
        website,
      },
      metadata: {
        publicSignup: {
          submittedAt: new Date().toISOString(),
          minCreditScoreOrRequirements: data.minCreditScore || null,
          preferredDeals: data.preferredDeals,
          noGoItems: data.noGoItems || null,
          referralNotes: data.referralNotes || null,
        },
        partnerProfile: {
          preferredBorrowers: data.preferredDeals,
          noGoItems: data.noGoItems || null,
          submissionNotes: data.referralNotes || null,
          partnerProcessOwner: data.contactName,
          referralProgramStatus: 'public_signup_received',
        },
      },
    })

    await updateLenderRecord(lender.id, {
      relationship_stage: 'reviewing',
      outreach_status: 'responded',
    })

    return NextResponse.json({ success: true, lenderId: lender.id })
  } catch (error) {
    console.error('Lender signup error:', error)
    return NextResponse.json({ error: 'Unable to save lender signup right now.' }, { status: 500 })
  }
}
