import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runNewLeadAutomation } from "@/lib/leads/leadAutomation"
import { persistPropertyBuyerMatches } from "@/lib/buyers/service"

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
  try {
    const data = await request.json()

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

    if (!loanType || !fullName || !email || !phone || !propertyAddress) {
      return NextResponse.json(
        { error: 'Missing required lead fields.' },
        { status: 400 }
      )
    }

    if (loanType !== 'dscr' && loanType !== 'hard-money') {
      return NextResponse.json(
        { error: 'Invalid real estate funding type.' },
        { status: 400 }
      )
    }

    if (
      loanType === 'dscr' &&
      (!entity ||
        !propertyType ||
        !purchasePrice ||
        !expectedRent ||
        !occupancy ||
        !downPaymentLtv ||
        !closingDate)
    ) {
      return NextResponse.json(
        { error: 'Missing required DSCR loan fields.' },
        { status: 400 }
      )
    }

    if (
      loanType === 'hard-money' &&
      (!experienceLevel ||
        !purchasePrice ||
        !rehabBudget ||
        !arv ||
        !exitStrategy ||
        !closingTimeline ||
        !fundsNeeded)
    ) {
      return NextResponse.json(
        { error: 'Missing required hard money loan fields.' },
        { status: 400 }
      )
    }

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

    if (leadsError) {
      console.error('Leads table error:', leadsError)
      // Do not fail the customer request if lead automation storage is unavailable.
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

    return NextResponse.json({ success: true, leadId: lead?.id ?? null })
  } catch (error: any) {
    console.error("Real estate lead submission error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to submit lead" },
      { status: 500 }
    )
  }
}
