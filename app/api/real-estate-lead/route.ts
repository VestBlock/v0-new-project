import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runNewLeadAutomation } from "@/lib/leads/leadAutomation"

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

    const supabaseAdmin = createAdminClient()
    const summary =
      loanType === 'dscr'
        ? `DSCR lead for ${propertyAddress || 'unknown property'}; purchase ${purchasePrice || 'unknown'}, rent ${expectedRent || 'unknown'}, closing ${closingDate || 'unknown'}.`
        : `Hard money lead for ${propertyAddress || 'unknown property'}; purchase ${purchasePrice || 'unknown'}, rehab ${rehabBudget || 'unknown'}, ARV ${arv || 'unknown'}.`

    // Save to unified leads table
    const { data: lead, error: leadsError } = await supabaseAdmin
      .from('leads')
      .insert({
        lead_type: 'real_estate',
        status: 'new',
        name: fullName,
        email: email,
        phone: phone,
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
            propertyAddress,
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
            propertyAddress,
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
        }
      })
      .select('id')
      .single()

    if (leadsError) {
      console.error('Leads table error:', leadsError)
      // Do not fail the customer request if lead automation storage is unavailable.
    } else {
      await runNewLeadAutomation({
        leadId: lead.id,
        leadType: 'real_estate',
        name: fullName,
        email,
        phone,
        sourcePath: '/real-estate-funding',
        summary,
        metadata: {
          loanType,
          creditScoreRange,
          propertyAddress,
          requestedLoanAmount,
          fundingGoal,
          purchaseContractStatus,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Real estate lead submission error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to submit lead" },
      { status: 500 }
    )
  }
}
