export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { getLeadEmailAutopilotDecision } from '@/lib/leads/autopilot'
import { listSuppressions } from '@/lib/leads/repository'
import { buildSourceFamilyFilters } from '@/lib/leads/source-keys'
import { logEvent } from '@/lib/system/logEvent'

function cleanLeadSearch(value: string) {
  return value.replace(/[,%()]/g, ' ').trim()
}

function hasUsableEmail(row: {
  email?: string | null
  email_valid?: boolean | null
  delivery_status?: string | null
  outreach_status?: string | null
  status?: string | null
}) {
  const email = typeof row.email === 'string' ? row.email.trim() : ''
  if (!email) return false
  if (row.email_valid === false) return false
  if (row.delivery_status === 'bounced') return false
  if (row.outreach_status === 'do_not_contact') return false
  if (row.status === 'do_not_contact') return false
  return true
}

export async function GET(request: NextRequest) {
  try {
    const { admin, response } = await requireLeadAdmin(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const leadType = searchParams.get('lead_type')
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const offer = searchParams.get('offer')
    const city = searchParams.get('city')
    const state = searchParams.get('state')
    const niche = searchParams.get('niche')
    const language = searchParams.get('language')
    const outreachStatus = searchParams.get('outreach_status')
    const deliveryStatus = searchParams.get('delivery_status')
    const search = searchParams.get('search')
    const minScore = Number(searchParams.get('min_score') || 0)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit
    const emailPriorityParam = searchParams.get('email_priority')
    const contactableOnly = searchParams.get('contactable_only') === '1'
    const emailPriority =
      emailPriorityParam === 'only' || emailPriorityParam === 'prioritize'
        ? emailPriorityParam
        : 'all'

    let query = admin.from('leads').select('*', { count: 'exact' })

    if (leadType && leadType !== 'all') query = query.eq('lead_type', leadType)
    if (status && status !== 'all') query = query.eq('status', status)
    if (source && source !== 'all') {
      query = query.or(buildSourceFamilyFilters('source', [source]))
    }
    if (offer && offer !== 'all') query = query.eq('best_offer', offer)
    if (city && city !== 'all') query = query.ilike('city', city)
    if (state && state !== 'all') query = query.ilike('state', state)
    if (niche && niche !== 'all') query = query.ilike('niche', niche)
    if (language && language !== 'all') query = query.eq('language_segment', language)
    if (outreachStatus && outreachStatus !== 'all') query = query.eq('outreach_status', outreachStatus)
    if (deliveryStatus && deliveryStatus !== 'all') query = query.eq('delivery_status', deliveryStatus)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`)
    if (minScore > 0) query = query.gte('lead_score', minScore)
    if (emailPriority === 'only') {
      query = query
        .not('email', 'is', null)
        .neq('email', '')
        .or('email_valid.is.null,email_valid.eq.true')
    }
    if (contactableOnly) {
      query = query.or(
        [
          'email.not.is.null',
          'phone.not.is.null',
          'website.not.is.null',
        ].join(',')
      )
    }

    if (search) {
      const cleaned = cleanLeadSearch(search)
      if (cleaned) {
        query = query.or(
          [
            `name.ilike.%${cleaned}%`,
            `email.ilike.%${cleaned}%`,
            `phone.ilike.%${cleaned}%`,
            `business_name.ilike.%${cleaned}%`,
            `property_address.ilike.%${cleaned}%`,
            `city.ilike.%${cleaned}%`,
          ].join(',')
        )
      }
    }

    if (emailPriority === 'prioritize' || emailPriority === 'only') {
      query = query
        .order('email_valid', { ascending: false, nullsFirst: false })
        .order('email', { ascending: false, nullsFirst: false })
        .order('lead_score', { ascending: false })
        .order('created_at', { ascending: false })
    } else {
      query = query.order('lead_score', { ascending: false }).order('created_at', { ascending: false })
    }

    const [{ data, error, count }, { data: summaryRows }, { data: failedRuns }, suppressions] = await Promise.all([
      query.range(offset, offset + limit - 1),
      admin
        .from('leads')
        .select('id,lead_type,source,source_url,status,outreach_status,lead_score,best_offer,language_segment,created_at,email,email_valid,delivery_status,phone,website,business_name,city,bounce_risk_score')
        .order('created_at', { ascending: false })
        .limit(1000),
      admin
        .from('scrape_runs')
        .select('source_key,status,started_at,error_message')
        .eq('status', 'failed')
        .order('started_at', { ascending: false })
        .limit(10),
      listSuppressions().catch(() => []),
    ])
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data || []).map((lead) => {
      const decision = getLeadEmailAutopilotDecision(lead, suppressions)
      return {
        ...lead,
        email_autopilot_eligible: decision.eligible,
        email_autopilot_reason: decision.reason,
      }
    })
    const blockerCounts = (summaryRows || []).reduce<Record<string, number>>((acc, lead) => {
      const decision = getLeadEmailAutopilotDecision(lead, suppressions)
      const reason =
        typeof decision.reason === 'string' && decision.reason
          ? decision.reason
          : decision.eligible
            ? 'eligible'
            : 'unknown'
      acc[reason] = (acc[reason] || 0) + 1
      return acc
    }, {})
    const summary = {
      total: count || 0,
      newToday: (summaryRows || []).filter((row) => {
        const createdAt = new Date(row.created_at || 0).getTime()
        return Number.isFinite(createdAt) && Date.now() - createdAt < 24 * 60 * 60 * 1000
      }).length,
      outreachReady: (summaryRows || []).filter((row) => row.outreach_status === 'needs_review' || row.outreach_status === 'approved').length,
      emailReady: (summaryRows || []).filter((row) => hasUsableEmail(row)).length,
      sent: (summaryRows || []).filter((row) => row.outreach_status === 'sent').length,
      highIntent: (summaryRows || []).filter((row) => Number(row.lead_score || 0) >= 75).length,
      averageScore:
        summaryRows && summaryRows.length
          ? Math.round(summaryRows.reduce((sum, row) => sum + Number(row.lead_score || 0), 0) / summaryRows.length)
          : 0,
      offers: Object.entries(
        (summaryRows || []).reduce<Record<string, number>>((acc, row) => {
          const key = row.best_offer || 'Unassigned'
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {})
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value]) => ({ label, value })),
      failedScrapes: (failedRuns || []).map((run) => ({
        source: run.source_key,
        startedAt: run.started_at,
        error: run.error_message,
      })),
      emailBlockers: Object.entries(blockerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([reason, value]) => ({ reason, value })),
    }

    return NextResponse.json({
      leads: rows,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      summary,
      filters: {
        contactableOnly,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch leads.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, user, response } = await requireLeadAdmin(request)
    if (response) return response

    const { id, status, outreachStatus, notes, bestOffer, ownerUserId, nextFollowUpAt, campaignName } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Lead id is required.' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (status) {
      updateData.status = status
      if (status === 'contacted') {
        updateData.last_contacted_at = new Date().toISOString()
      }
    }
    if (outreachStatus) updateData.outreach_status = outreachStatus
    if (typeof notes === 'string') updateData.notes = notes
    if (typeof bestOffer === 'string') updateData.best_offer = bestOffer
    if (ownerUserId !== undefined) updateData.owner_user_id = ownerUserId
    if (nextFollowUpAt !== undefined) updateData.next_follow_up_at = nextFollowUpAt
    if (campaignName !== undefined) updateData.campaign_name = campaignName

    const { data, error } = await admin
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'lead',
      entityId: id,
      metadata: {
        action: 'lead_updated',
        status: status || null,
        outreachStatus: outreachStatus || null,
        bestOffer: bestOffer || null,
      },
    })

    return NextResponse.json({ success: true, lead: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update lead.' },
      { status: 500 }
    )
  }
}
