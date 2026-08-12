import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { runNewLeadAutomation } from "@/lib/leads/leadAutomation"
import { persistPropertyBuyerMatches } from "@/lib/buyers/service"
import { guardPublicMutation } from "@/lib/security/public-mutation"

const optionalText = (max: number) => z.string().trim().max(max).optional().default('')

const realEstateLeadSchema = z.object({
  loanType: z.enum(['dscr', 'hard-money']),
  fullName: z.string().trim().min(2).max(140),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(7).max(40),
  creditScoreRange: optionalText(80),
  requestedLoanAmount: optionalText(80),
  availableLiquidity: optionalText(80),
  vestingOrEntityName: optionalText(160),
  fundingGoal: optionalText(500),
  entity: optionalText(160),
  propertyAddress: z.string().trim().min(3).max(260),
  propertyType: optionalText(120),
  purchasePrice: optionalText(80),
  estimatedValue: optionalText(80),
  expectedRent: optionalText(80),
  occupancy: optionalText(120),
  downPaymentLtv: optionalText(80),
  taxesInsuranceHoa: optionalText(120),
  closingDate: optionalText(80),
  notes: optionalText(1600),
  experienceLevel: optionalText(120),
  rehabBudget: optionalText(80),
  arv: optionalText(80),
  exitStrategy: optionalText(160),
  closingTimeline: optionalText(120),
  fundsNeeded: optionalText(120),
  purchaseContractStatus: optionalText(120),
  contractorReady: optionalText(120),
}).superRefine((data, context) => {
  const required = data.loanType === 'dscr'
    ? ['creditScoreRange', 'entity', 'propertyType', 'purchasePrice', 'expectedRent', 'occupancy', 'downPaymentLtv', 'closingDate'] as const
    : ['experienceLevel', 'purchasePrice', 'rehabBudget', 'arv', 'exitStrategy', 'closingTimeline', 'fundsNeeded'] as const

  for (const field of required) {
    if (!data[field]) context.addIssue({ code: 'custom', path: [field], message: 'Required field.' })
  }
})

function parseCurrency(value?: string | number | null) {
  if (value === null || value === undefined) return null
  const cleaned = String(value).replace(/[^0-9.]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parsePropertyLocation(address?: string | null) {
  if (!address) {
    return { city: null as string | null, state: null as string | null, marketTag: null as string | null }
  }

  const segments = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (segments.length < 2) {
    return { city: null, state: null, marketTag: null }
  }

  const city = segments.at(-2) || null
  const stateSegment = segments.at(-1) || ''
  const state = stateSegment.split(/\s+/)[0] || null
  return {
    city,
    state,
    marketTag: city && state ? `${city}, ${state}` : city || state || null,
  }
}

function buildPropertyAddress(address?: string | null, city?: string | null, state?: string | null) {
  const parts = [address, city, state]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)

  if (!parts.length) return null
  return parts.join(', ').replace(/\s+,/g, ',').replace(/,\s*,/g, ', ')
}

export async function POST(request: NextRequest) {
  const guard = guardPublicMutation(request, { scope: 'real-estate-lead', maxRequests: 5 })
  if (guard) return guard

  try {
    const parsed = realEstateLeadSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Check the real-estate funding form and try again.', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const data = parsed.data

    const {
      loanType,
      fullName,
      email,
      phone,
      creditScoreRange,
      requestedLoanAmount,
      availableLiquidity,
      vestingOrEntityName,
      fundingGoal,
      // DSCR fields
      entity,
      propertyAddress,
      propertyType,
      purchasePrice,
      estimatedValue,
      expectedRent,
      occupancy,
      downPaymentLtv,
      taxesInsuranceHoa,
      closingDate,
      notes,
      // Hard Money fields
      experienceLevel,
      rehabBudget,
      arv,
      exitStrategy,
      closingTimeline,
      fundsNeeded,
      purchaseContractStatus,
      contractorReady
    } = data

    const supabaseAdmin = createAdminClient()
    const normalizedPropertyAddress = buildPropertyAddress(propertyAddress, null, null)
    const parsedLocation = parsePropertyLocation(normalizedPropertyAddress)
    const summary =
      loanType === 'dscr'
        ? `DSCR lead for ${normalizedPropertyAddress || 'unknown property'}; purchase ${purchasePrice || 'unknown'}, rent ${expectedRent || 'unknown'}, closing ${closingDate || 'unknown'}.`
        : `Hard money lead for ${normalizedPropertyAddress || 'unknown property'}; purchase ${purchasePrice || 'unknown'}, rehab ${rehabBudget || 'unknown'}, ARV ${arv || 'unknown'}.`

    // Save to unified leads table
    const { data: lead, error: leadsError } = await supabaseAdmin
      .from('leads')
      .insert({
        lead_type: 'real_estate',
        status: 'new',
        source: 'real_estate_funding_form',
        source_url: '/real-estate-funding',
        category: 'real_estate',
        name: fullName,
        email: email,
        phone: phone,
        property_address: normalizedPropertyAddress,
        city: parsedLocation.city,
        state: parsedLocation.state,
        best_offer: 'Real Estate Funding Review',
        pain_signal: summary,
        contact_info: {
          name: fullName,
          email: email,
          phone: phone
        },
        form_data: {
          loanType,
          creditScoreRange,
          requestedLoanAmount,
          availableLiquidity,
          vestingOrEntityName,
          fundingGoal,
          ...(loanType === 'dscr' ? {
            entity,
            propertyAddress: normalizedPropertyAddress,
            propertyType,
            purchasePrice,
            estimatedValue,
            expectedRent,
            occupancy,
            downPaymentLtv,
            taxesInsuranceHoa,
            closingDate,
            notes
          } : {
            experienceLevel,
            propertyAddress: normalizedPropertyAddress,
            purchasePrice,
            rehabBudget,
            arv,
            exitStrategy,
            closingTimeline,
            fundsNeeded,
            purchaseContractStatus,
            contractorReady,
            notes
          })
        },
        market_segment: 'real_estate_funding',
        outreach_angle: 'Deal funding and property exit support',
        notes: summary,
      })
      .select('id')
      .single()

    if (leadsError || !lead?.id) {
      console.error('Leads table error:', leadsError)
      return NextResponse.json(
        { error: 'Unable to save your funding request right now.' },
        { status: 500 }
      )
    } else {
      void Promise.allSettled([
        runNewLeadAutomation({
          leadId: lead.id,
          leadType: 'real_estate',
          name: fullName,
          email,
          phone,
          propertyAddress: normalizedPropertyAddress,
          city: parsedLocation.city,
          state: parsedLocation.state,
          sourcePath: '/real-estate-funding',
          summary,
          metadata: {
            loanType,
            creditScoreRange,
            propertyAddress: normalizedPropertyAddress,
            city: parsedLocation.city,
            state: parsedLocation.state,
            requestedLoanAmount,
            fundingGoal,
            purchaseContractStatus,
          },
        }),
        persistPropertyBuyerMatches({
          leadId: lead.id,
          serviceType: 'real_estate_funding',
          propertyAddress: normalizedPropertyAddress,
          city: parsedLocation.city,
          state: parsedLocation.state,
          assetType: propertyType || null,
          occupancy: occupancy || null,
          distressLevel: loanType === 'hard-money' ? 8 : 4,
          rehabLevel: loanType === 'hard-money' ? 8 : 3,
          askingPrice: parseCurrency(purchasePrice),
          estimatedValue: parseCurrency(estimatedValue) ?? parseCurrency(arv),
          landlordSignal: occupancy?.toLowerCase().includes('tenant') || occupancy?.toLowerCase().includes('rental') || false,
          sellerMotivation: fundingGoal || exitStrategy || notes || null,
          timelineDays: loanType === 'hard-money' ? 21 : 30,
          creativeFinanceOpen: /seller finance|subject to|creative/i.test(exitStrategy || '') || /seller finance|subject to|creative/i.test(notes || ''),
          languagePreference: /spanish|espanol/i.test(notes || '') ? 'es' : 'en',
          marketTag: parsedLocation.marketTag,
        }),
      ]).then((results) => {
        const rejected = results.filter((result) => result.status === 'rejected')
        if (rejected.length > 0) {
          console.error('Real estate lead follow-up tasks failed:', rejected)
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Real estate lead submission error:", error)
    return NextResponse.json(
      { error: "Unable to save your funding request right now." },
      { status: 500 }
    )
  }
}
