import { NextResponse } from 'next/server'

import { checkAdminAccess } from '@/lib/auth/admin'
import { absoluteUrl } from '@/lib/seo/site'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csvEscape(value: unknown) {
  const stringValue = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function getServiceLabel(serviceKey: string | null) {
  switch (serviceKey) {
    case 'ai_receptionist':
      return 'AI receptionist and booking'
    case 'visibility_expansion':
      return 'SEO and visibility growth'
    case 'real_estate_funding':
      return 'real estate funding'
    case 'business_credit':
      return 'business credit support'
    case 'sell_my_home':
      return 'seller support'
    case 'business_funding':
    default:
      return 'business funding support'
  }
}

function buildFacebookGroupComment(row: {
  title: string
  service_key: string | null
  audience: string | null
  publish_path: string | null
  social_caption: string | null
  hashtags: string[] | null
}) {
  if (row.social_caption?.trim()) {
    const hashtags = row.hashtags?.length ? ` ${row.hashtags.join(' ')}` : ''
    return `${row.social_caption.trim()} ${absoluteUrl(row.publish_path || '/resources')}${hashtags}`.trim()
  }

  const serviceLabel = getServiceLabel(row.service_key)
  const audiencePhrase = row.audience ? ` for ${row.audience}` : ''
  const pageUrl = absoluteUrl(row.publish_path || '/resources')

  return [
    `Sharing this in case it helps someone looking into ${serviceLabel}${audiencePhrase}.`,
    `${row.title} walks through the key points in a simpler way and gives a practical next step.`,
    pageUrl,
  ].join(' ')
}

function buildLinkedInCaption(row: {
  title: string
  service_key: string | null
  audience: string | null
  publish_path: string | null
}) {
  const serviceLabel = getServiceLabel(row.service_key)
  const audiencePhrase = row.audience ? ` for ${row.audience}` : ''
  const pageUrl = absoluteUrl(row.publish_path || '/resources')

  return [
    `New VestBlock resource: ${row.title}`,
    `Built to make ${serviceLabel}${audiencePhrase} easier to understand without generic agency filler.`,
    pageUrl,
  ].join(' ')
}

function buildManualOutreachAngle(row: {
  title: string
  service_key: string | null
  audience: string | null
}) {
  return `Useful share for conversations about ${getServiceLabel(row.service_key)}${row.audience ? ` for ${row.audience}` : ''}: ${row.title}`
}

export async function GET() {
  const adminCheck = await checkAdminAccess()
  if (!adminCheck.isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: adminCheck.user ? 403 : 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('content_assets')
    .select('id,title,slug,status,service_key,audience,publish_path,social_caption,hashtags,published_at,updated_at')
    .eq('content_type', 'seo_page')
    .not('publish_path', 'is', null)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(1000)

  if (error) {
    return NextResponse.json({ error: error.message || 'Unable to export SEO content.' }, { status: 500 })
  }

  const header = [
    'id',
    'title',
    'service_key',
    'status',
    'published_at',
    'page_url',
    'manual_outreach_angle',
    'linkedin_caption',
    'facebook_group_comment',
  ]

  const body = (data || []).map((row) =>
    [
      row.id,
      row.title,
      row.service_key,
      row.status,
      row.published_at,
      absoluteUrl(row.publish_path || `/resources/${row.slug}`),
      buildManualOutreachAngle({
        title: row.title,
        service_key: row.service_key,
        audience: row.audience,
      }),
      buildLinkedInCaption({
        title: row.title,
        service_key: row.service_key,
        audience: row.audience,
        publish_path: row.publish_path,
      }),
      buildFacebookGroupComment({
        title: row.title,
        service_key: row.service_key,
        audience: row.audience,
        publish_path: row.publish_path,
        social_caption: row.social_caption,
        hashtags: Array.isArray(row.hashtags) ? row.hashtags.filter((item): item is string => typeof item === 'string') : [],
      }),
    ]
      .map(csvEscape)
      .join(',')
  )

  return new NextResponse([header.join(','), ...body].join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="vestblock-live-seo-pages-facebook.csv"',
    },
  })
}
