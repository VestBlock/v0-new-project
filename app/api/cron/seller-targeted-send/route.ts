export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'

import { getLeadById } from '@/lib/leads/repository'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function flag(value: string | null, fallback: boolean) {
  if (value === null) return fallback
  return /^(1|true|yes|on)$/i.test(value)
}

/**
 * Historical operator endpoint retained as an explicit policy tombstone.
 * Seller/consumer cold email is not an eligible Outlook lane. Keeping this
 * route fail-closed prevents old bookmarks or automation from reviving it and
 * makes dry-run reporting match the live policy decision.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const leadId = String(url.searchParams.get('leadId') || '').trim()
    const dryRun = flag(url.searchParams.get('dryRun'), true)
    if (!leadId) return NextResponse.json({ error: 'leadId is required.' }, { status: 400 })

    const { lead } = await getLeadById(leadId)
    if (lead.category !== 'seller_lead' && lead.lead_type !== 'sell_house') {
      return NextResponse.json({ error: 'This route only evaluates seller outreach.' }, { status: 400 })
    }

    return NextResponse.json(
      {
        success: false,
        dryRun,
        wouldSend: false,
        policyHold: true,
        reason: 'seller_cold_email_prohibited',
        nextChannel: 'non_email_review',
        leadId,
      },
      { status: 409 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Seller outreach policy check failed.' },
      { status: 500 }
    )
  }
}
