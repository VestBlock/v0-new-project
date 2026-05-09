export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { getLeadEmailAutopilotDecision } from '@/lib/leads/autopilot'
import { listSuppressions } from '@/lib/leads/repository'
import { getSourceFamily } from '@/lib/leads/source-keys'
import { buildSourceFamilyFilters } from '@/lib/leads/source-keys'
import { exportLeadsSchema } from '@/lib/leads/schemas'
import { createAdminClient } from '@/lib/supabase/admin'
import type { LeadRecord } from '@/lib/leads/types'

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function getContactFormUrls(lead: LeadRecord) {
  const urls = lead.contact_info?.contactFormUrls
  if (!Array.isArray(urls)) return []
  return urls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function getPublicEmailCandidates(lead: LeadRecord) {
  const candidates = lead.contact_info?.publicEmailCandidates
  if (!Array.isArray(candidates)) return []
  return candidates
    .map((candidate) => {
      if (typeof candidate === 'string') return candidate.trim()
      if (candidate && typeof candidate === 'object' && 'email' in candidate && typeof candidate.email === 'string') {
        return candidate.email.trim()
      }
      return ''
    })
    .filter(Boolean)
}

function getRecommendedNextAction(lead: LeadRecord, blockerReason: string | null) {
  const contactFormUrls = getContactFormUrls(lead)
  if (contactFormUrls.length > 0) return 'Research and submit contact form manually'
  if (lead.website && !lead.email) return 'Research website or domain for direct business email'
  if (lead.phone && !lead.email) return 'Call or text first, then source direct email'
  if (blockerReason === 'mismatched_domain') return 'Verify email against company domain before outreach'
  if (blockerReason === 'invalid_email') return 'Replace invalid email before outreach'
  if (blockerReason === 'institutional_domain') return 'Route to manual review; institutional email'
  if (blockerReason === 'platform_email') return 'Find direct business email off platform'
  return 'Research direct contact details offline'
}

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const { searchParams } = new URL(request.url)
  const parsed = exportLeadsSchema.safeParse({
    source: searchParams.get('source') || undefined,
    offer: searchParams.get('offer') || undefined,
    city: searchParams.get('city') || undefined,
    state: searchParams.get('state') || undefined,
    niche: searchParams.get('niche') || undefined,
    minScore: searchParams.get('minScore') || undefined,
    status: searchParams.get('status') || undefined,
    outreachStatus: searchParams.get('outreachStatus') || undefined,
    deliveryStatus: searchParams.get('deliveryStatus') || undefined,
    emailReady: searchParams.get('emailReady') || undefined,
    preset: searchParams.get('preset') || undefined,
    selectedIds: searchParams.get('selectedIds')
      ? searchParams.get('selectedIds')!.split(',').filter(Boolean)
      : undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const suppressions = await listSuppressions().catch(() => [])
  let query = admin.from('leads').select('*').order('lead_score', { ascending: false })
  if (parsed.data.source) query = query.or(buildSourceFamilyFilters('source', [parsed.data.source]))
  if (parsed.data.offer) query = query.eq('best_offer', parsed.data.offer)
  if (parsed.data.city) query = query.ilike('city', parsed.data.city)
  if (parsed.data.state) query = query.ilike('state', parsed.data.state)
  if (parsed.data.niche) query = query.ilike('niche', parsed.data.niche)
  if (parsed.data.minScore !== undefined) query = query.gte('lead_score', parsed.data.minScore)
  if (parsed.data.status) query = query.eq('status', parsed.data.status)
  if (parsed.data.outreachStatus) query = query.eq('outreach_status', parsed.data.outreachStatus)
  if (parsed.data.deliveryStatus) query = query.eq('delivery_status', parsed.data.deliveryStatus)
  if (parsed.data.emailReady) {
    query = query.not('email', 'is', null).neq('email', '').or('email_valid.is.null,email_valid.eq.true')
  }
  if (parsed.data.selectedIds?.length) query = query.in('id', parsed.data.selectedIds)

  if (parsed.data.preset === 'contacted') query = query.in('status', ['contacted', 'replied', 'interested', 'qualified', 'closed_won'])
  if (parsed.data.preset === 'bounced') query = query.eq('delivery_status', 'bounced')
  if (parsed.data.preset === 'high_score') query = query.gte('lead_score', 80)
  if (parsed.data.preset === 'no_email') {
    query = query.or('email.is.null,email.eq.')
  }

  const { data, error } = await query.limit(5000)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const leads = ((data || []) as LeadRecord[]).map((lead) => {
    const decision = getLeadEmailAutopilotDecision(lead, suppressions)
    const contactFormUrls = getContactFormUrls(lead)
    const publicEmailCandidates = getPublicEmailCandidates(lead)

    return {
      ...lead,
      sourceFamily: getSourceFamily(lead.source),
      blockerReason: decision.reason,
      contactFormUrls,
      publicEmailCandidates,
      recommendedNextAction: getRecommendedNextAction(lead, decision.reason),
    }
  })

  const rows = [
    [
      'ID',
      'Source',
      'Source Family',
      'Category',
      'Business Name',
      'Name',
      'Email',
      'Phone',
      'Website',
      'Has Contact Form',
      'Contact Form URLs',
      'Public Email Candidates',
      'Email Blocker Reason',
      'Recommended Next Action',
      'City',
      'State',
      'Niche',
      'Best Offer',
      'Lead Score',
      'Status',
      'Outreach Status',
      'Delivery Status',
      'Campaign',
      'Pain Signal',
      'Created At',
    ],
    ...leads.map((lead) => [
      lead.id,
      lead.source || '',
      lead.sourceFamily || '',
      lead.category || '',
      lead.business_name || '',
      lead.name || '',
      lead.email || '',
      lead.phone || '',
      lead.website || '',
      lead.contactFormUrls.length ? 'Yes' : 'No',
      lead.contactFormUrls.join(' | '),
      lead.publicEmailCandidates.join(' | '),
      lead.blockerReason || '',
      lead.recommendedNextAction,
      lead.city || '',
      lead.state || '',
      lead.niche || '',
      lead.best_offer || '',
      String(lead.lead_score || 0),
      lead.status || '',
      lead.outreach_status || '',
      lead.delivery_status || '',
      lead.campaign_name || '',
      lead.pain_signal || '',
      lead.created_at || '',
    ]),
  ]

  const csv = rows.map((row) => row.map((cell) => escapeCsv(String(cell))).join(',')).join('\n')
  const filenamePrefix = parsed.data.preset === 'no_email' ? 'vestblock-no-email-leads' : 'vestblock-leads'
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
