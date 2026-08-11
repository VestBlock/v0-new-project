export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BUYER_CATEGORY_TO_TYPE } from '@/lib/buyers/constants'
import {
  insertBuyerRelationshipEvent,
  replaceBuyerBuyBoxes,
  replaceBuyerContacts,
  replaceBuyerMarkets,
  updateBuyerRecord,
  upsertBuyer,
} from '@/lib/buyers/repository'
import { ensureSignupGrowthSystem } from '@/lib/auth/signup-growth-system'
import { sendUserSignupGrowthSystemReadyEmail } from '@/lib/email/sendEmail'
import type { BuyerCategory } from '@/lib/buyers/types'

const buyerSignupSchema = z.object({
  companyName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(80).optional().default(''),
  website: z.string().trim().max(300).optional().default(''),
  category: z.enum([
    'local_cash_buyer',
    'fix_and_flip_buyer',
    'landlord_buyer',
    'small_multifamily_buyer',
    'creative_finance_buyer',
    'land_buyer',
    'commercial_buyer',
    'hedge_fund_buyer',
  ]),
  marketsServed: z.string().trim().min(2).max(1000),
  assetTypes: z.string().trim().min(2).max(500),
  priceMin: z.string().trim().max(80).optional().default(''),
  priceMax: z.string().trim().max(80).optional().default(''),
  closingSpeed: z.string().trim().max(120).optional().default(''),
  proofOfFundsStatus: z.string().trim().max(200).optional().default(''),
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

function parseList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 120)
}

function splitMarketParts(markets: string[]) {
  const states = new Set<string>()
  const cities = new Set<string>()
  const metros = new Set<string>()

  for (const market of markets) {
    const parts = market.split(',').map((part) => part.trim()).filter(Boolean)
    if (parts.length >= 2) {
      cities.add(parts[0])
      states.add(parts[1].toUpperCase())
      metros.add(market)
      continue
    }

    if (/^[A-Za-z]{2}$/.test(market)) states.add(market.toUpperCase())
    else metros.add(market)
  }

  return {
    states: Array.from(states),
    cities: Array.from(cities),
    metros: Array.from(metros),
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}))
    const parsed = buyerSignupSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Please complete the required buyer signup fields.' }, { status: 400 })
    }

    const data = parsed.data
    const category = data.category as BuyerCategory
    const marketsServed = parseList(data.marketsServed)
    const assetTypes = parseList(data.assetTypes)
    const marketParts = splitMarketParts(marketsServed)
    const priceMin = parseCurrency(data.priceMin)
    const priceMax = parseCurrency(data.priceMax)
    const website = normalizeWebsite(data.website)
    const nationalOrRegional =
      marketParts.states.length > 8 ? 'national' : marketParts.states.length > 1 ? 'multi_state' : 'local'

    const buyer = await upsertBuyer({
      name: data.companyName,
      website,
      buyerType: BUYER_CATEGORY_TO_TYPE[category] || 'local_operator',
      category,
      headquartersCity: marketParts.cities[0] || null,
      headquartersState: marketParts.states[0] || null,
      marketsServed,
      nationalOrRegional,
      contactEmail: data.email,
      contactPhone: data.phone || null,
      contactName: data.contactName,
      source: 'public_buyer_signup',
      sourceUrl: '/buyers',
      fitSummary: data.preferredDeals,
      notes: [data.preferredDeals, data.noGoItems ? `No-go items: ${data.noGoItems}` : '', data.referralNotes ? `Referral notes: ${data.referralNotes}` : '']
        .filter(Boolean)
        .join('\n\n'),
      proofOfFundsStatus: data.proofOfFundsStatus || null,
      closingSpeed: data.closingSpeed || null,
      contactInfo: {
        contactName: data.contactName,
        email: data.email,
        phone: data.phone || null,
        website,
      },
      metadata: {
        publicSignup: {
          submittedAt: new Date().toISOString(),
          assetTypes,
          marketsServed,
          priceMin,
          priceMax,
          preferredDeals: data.preferredDeals,
          noGoItems: data.noGoItems || null,
          referralNotes: data.referralNotes || null,
        },
      },
    })

    await Promise.all([
      replaceBuyerBuyBoxes(buyer.id, [
        {
          buy_box_name: 'Public signup buy box',
          asset_types: assetTypes,
          states: marketParts.states,
          cities: marketParts.cities,
          metros: marketParts.metros,
          price_min: priceMin,
          price_max: priceMax,
          preferred_deal_types: [],
          closing_speed: data.closingSpeed || null,
          proof_of_funds_status: data.proofOfFundsStatus || null,
          active: true,
          notes: [data.preferredDeals, data.noGoItems ? `No-go items: ${data.noGoItems}` : ''].filter(Boolean).join('\n\n'),
          metadata_json: {
            referralNotes: data.referralNotes || null,
            submittedFrom: '/buyers',
          },
        },
      ]),
      replaceBuyerMarkets(
        buyer.id,
        marketsServed.map((market) => ({
          city: market.includes(',') ? market.split(',')[0].trim() : null,
          state: /^[A-Za-z]{2}$/.test(market) ? market.toUpperCase() : market.includes(',') ? market.split(',').at(-1)?.trim().toUpperCase() : null,
          metro_area: market,
          market_type: 'target',
          active: true,
        }))
      ),
      replaceBuyerContacts(buyer.id, [
        {
          name: data.contactName,
          email: data.email,
          phone: data.phone || null,
          preferred_channel: 'email',
          is_primary: true,
          confidence_score: 90,
        },
      ]),
      updateBuyerRecord(buyer.id, {
        relationship_stage: 'reviewing',
        outreach_status: 'responded',
      }),
      insertBuyerRelationshipEvent({
        buyerId: buyer.id,
        eventType: 'public_signup_received',
        metadata: {
          source: '/buyers',
          category,
          marketsServed,
        },
      }),
    ])

    let growthSystemResult: Awaited<ReturnType<typeof ensureSignupGrowthSystem>> = {
      ok: false,
      created: false,
      error: 'Growth System provisioning was not attempted.',
    }
    let emailResult: { ok: boolean; skipped?: boolean } = { ok: false, skipped: true }

    try {
      growthSystemResult = await ensureSignupGrowthSystem({
        email: data.email,
        fullName: data.contactName,
      })

      if (growthSystemResult.ok && growthSystemResult.created) {
        emailResult = await sendUserSignupGrowthSystemReadyEmail({
          userEmail: data.email,
          fullName: data.contactName,
        })
      } else {
        emailResult = { ok: true, skipped: true }
      }
    } catch (growthSystemError) {
      console.error('Buyer signup Growth System provisioning error:', growthSystemError)
    }

    return NextResponse.json({
      success: true,
      buyerId: buyer.id,
      growthSystemReady: Boolean(growthSystemResult.ok),
      growthSystemCreated: Boolean(growthSystemResult.created),
      growthSystemLeadId: growthSystemResult.leadId || null,
      growthSystemEmailSent: Boolean(emailResult?.ok),
      registerUrl: `/register?redirect=${encodeURIComponent('/dashboard/services')}&email=${encodeURIComponent(data.email)}`,
      loginUrl: `/login?redirect=${encodeURIComponent('/dashboard/services')}&email=${encodeURIComponent(data.email)}`,
    })
  } catch (error) {
    console.error('Buyer signup error:', error)
    return NextResponse.json({ error: 'Unable to save buyer signup right now.' }, { status: 500 })
  }
}
