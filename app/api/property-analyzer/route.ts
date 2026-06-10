export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildRoughPropertyEstimate } from '@/lib/property/roughEstimate'
import { buildPropertyOpportunityAnalysis } from '@/lib/property/opportunityAnalysis'

const analyzerSchema = z.object({
  propertyAddress: z.string().trim().min(3).max(260),
  city: z.string().trim().max(120).optional().default(''),
  state: z.string().trim().max(80).optional().default(''),
  zipCode: z.string().trim().max(20).optional().default(''),
  propertyType: z.string().trim().max(120).optional().default(''),
  bedrooms: z.string().trim().max(20).optional().default(''),
  bathrooms: z.string().trim().max(20).optional().default(''),
  squareFeet: z.string().trim().max(40).optional().default(''),
  propertyCondition: z.string().trim().max(120).optional().default(''),
  timelineToSell: z.string().trim().max(120).optional().default(''),
  occupancyStatus: z.string().trim().max(120).optional().default(''),
  estimatedValue: z.string().trim().max(80).optional().default(''),
  askingPrice: z.string().trim().max(80).optional().default(''),
  afterRepairValue: z.string().trim().max(80).optional().default(''),
  repairBudget: z.string().trim().max(80).optional().default(''),
  mortgageBalance: z.string().trim().max(80).optional().default(''),
  liensOrTaxes: z.string().trim().max(80).optional().default(''),
  monthlyTaxes: z.string().trim().max(80).optional().default(''),
  monthlyInsurance: z.string().trim().max(80).optional().default(''),
  monthlyDebtService: z.string().trim().max(80).optional().default(''),
  targetMonthlyCashFlow: z.string().trim().max(80).optional().default(''),
  creativeDownPayment: z.string().trim().max(80).optional().default(''),
  creativeNoteInterestRate: z.string().trim().max(40).optional().default(''),
  creativeAmortizationYears: z.string().trim().max(40).optional().default(''),
  creativeBalloonYears: z.string().trim().max(40).optional().default(''),
  existingLoanInterestRate: z.string().trim().max(40).optional().default(''),
  existingLoanRemainingTermYears: z.string().trim().max(40).optional().default(''),
  preferredSalePath: z.string().trim().max(120).optional().default('not_sure'),
})

function buildFullAddress(data: z.infer<typeof analyzerSchema>) {
  const parts = [data.propertyAddress, data.city, data.state, data.zipCode]
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.join(', ').replace(/\s+,/g, ',').replace(/,\s*,/g, ', ')
}

export async function POST(request: NextRequest) {
  try {
    const parsed = analyzerSchema.safeParse(await request.json().catch(() => ({})))

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Enter at least a property address before running the analyzer.' },
        { status: 400 }
      )
    }

    const data = parsed.data
    const address = buildFullAddress(data)
    const estimate = await buildRoughPropertyEstimate({
      address,
      city: data.city || null,
      state: data.state || null,
      propertyType: data.propertyType || null,
      bedrooms: data.bedrooms || null,
      bathrooms: data.bathrooms || null,
      squareFeet: data.squareFeet || null,
      sellerEstimatedValue: data.estimatedValue || null,
      askingPrice: data.askingPrice || null,
      mortgageBalance: data.mortgageBalance || null,
      liensOrTaxes: data.liensOrTaxes || null,
      propertyCondition: data.propertyCondition || null,
      timelineToSell: data.timelineToSell || null,
      occupancyStatus: data.occupancyStatus || null,
      preferredSalePath: data.preferredSalePath || null,
    })
    const opportunity = buildPropertyOpportunityAnalysis(
      {
        address,
        city: data.city || null,
        state: data.state || null,
        propertyType: data.propertyType || null,
        bedrooms: data.bedrooms || null,
        bathrooms: data.bathrooms || null,
        squareFeet: data.squareFeet || null,
        sellerEstimatedValue: data.estimatedValue || null,
        askingPrice: data.askingPrice || null,
        mortgageBalance: data.mortgageBalance || null,
        liensOrTaxes: data.liensOrTaxes || null,
        propertyCondition: data.propertyCondition || null,
        timelineToSell: data.timelineToSell || null,
        occupancyStatus: data.occupancyStatus || null,
        preferredSalePath: data.preferredSalePath || null,
        afterRepairValue: data.afterRepairValue || null,
        repairBudget: data.repairBudget || null,
        monthlyTaxes: data.monthlyTaxes || null,
        monthlyInsurance: data.monthlyInsurance || null,
        monthlyDebtService: data.monthlyDebtService || null,
        targetMonthlyCashFlow: data.targetMonthlyCashFlow || null,
        creativeDownPayment: data.creativeDownPayment || null,
        creativeNoteInterestRate: data.creativeNoteInterestRate || null,
        creativeAmortizationYears: data.creativeAmortizationYears || null,
        creativeBalloonYears: data.creativeBalloonYears || null,
        existingLoanInterestRate: data.existingLoanInterestRate || null,
        existingLoanRemainingTermYears: data.existingLoanRemainingTermYears || null,
      },
      estimate
    )

    return NextResponse.json({
      success: true,
      address,
      estimate,
      opportunity,
    })
  } catch (error) {
    console.error('Property analyzer error:', error)
    return NextResponse.json(
      { error: 'Unable to analyze this property right now.' },
      { status: 500 }
    )
  }
}
