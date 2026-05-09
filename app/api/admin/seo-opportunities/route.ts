export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { absoluteUrl } from '@/lib/seo/site'
import {
  getEntitySeoOpportunity,
  listEntitySeoOpportunities,
  updateEntitySeoOpportunity,
} from '@/lib/reporting/repository'
import { publishEntitySeoOpportunity, regenerateEntitySeoOpportunity } from '@/lib/content/entitySeoExpansion'
import { logEvent } from '@/lib/system/logEvent'

function csvEscape(value: unknown) {
  const stringValue = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function getOpportunityPagePath(row: {
  suggested_slug: string
  content_asset_id: string | null
  publish_status: string
}) {
  if (row.content_asset_id || row.publish_status === 'published') {
    return `/resources/${row.suggested_slug}`
  }
  return ''
}

function getServiceLabel(serviceFocus: string | null) {
  switch (serviceFocus) {
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
  suggested_title: string
  suggested_service_focus: string | null
  city: string | null
  state: string | null
  suggested_slug: string
  content_asset_id: string | null
  publish_status: string
}) {
  const serviceLabel = getServiceLabel(row.suggested_service_focus)
  const location = [row.city, row.state].filter(Boolean).join(', ')
  const path = getOpportunityPagePath(row)
  const link = path ? absoluteUrl(path) : `https://www.vestblock.io/resources/${row.suggested_slug}`
  const locationPhrase = location ? ` in ${location}` : ''

  return [
    `Dropping this here in case it helps someone${locationPhrase} working on ${serviceLabel}.`,
    `${row.suggested_title} breaks down the main points in a simpler way and gives a practical next step.`,
    link,
  ].join(' ')
}

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  try {
    const { searchParams } = new URL(request.url)
    const rows = await listEntitySeoOpportunities({
      city: searchParams.get('city'),
      state: searchParams.get('state'),
      entityType: searchParams.get('entityType'),
      serviceFocus: searchParams.get('serviceFocus'),
      publishStatus: searchParams.get('publishStatus'),
      approvalStatus: searchParams.get('approvalStatus'),
      limit: Number.parseInt(searchParams.get('limit') || '150', 10),
    })

    if (searchParams.get('format') === 'csv') {
      const channel = searchParams.get('channel')

      if (channel === 'facebook_groups') {
        const header = [
          'id',
          'entity_type',
          'entity_name',
          'city',
          'state',
          'suggested_title',
          'suggested_service_focus',
          'publish_status',
          'page_url',
          'facebook_group_comment',
        ]
        const body = rows.map((row) =>
          [
            row.id,
            row.entity_type,
            row.entity_name,
            row.city,
            row.state,
            row.suggested_title,
            row.suggested_service_focus,
            row.publish_status,
            getOpportunityPagePath(row) ? absoluteUrl(getOpportunityPagePath(row)) : '',
            buildFacebookGroupComment(row),
          ]
            .map(csvEscape)
            .join(',')
        )

        return new NextResponse([header.join(','), ...body].join('\n'), {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="vestblock-seo-facebook-outreach.csv"',
          },
        })
      }

      const header = [
        'id',
        'entity_type',
        'entity_name',
        'city',
        'state',
        'cluster_type',
        'opportunity_score',
        'suggested_title',
        'suggested_slug',
        'suggested_service_focus',
        'approval_status',
        'publish_status',
        'source_reason',
      ]
      const body = rows.map((row) =>
        [
          row.id,
          row.entity_type,
          row.entity_name,
          row.city,
          row.state,
          row.cluster_type,
          row.opportunity_score,
          row.suggested_title,
          row.suggested_slug,
          row.suggested_service_focus,
          row.approval_status,
          row.publish_status,
          row.source_reason,
        ]
          .map(csvEscape)
          .join(',')
      )

      return new NextResponse([header.join(','), ...body].join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="vestblock-seo-opportunities.csv"',
        },
      })
    }

    const summary = {
      total: rows.length,
      published: rows.filter((row) => row.publish_status === 'published').length,
      queued: rows.filter((row) => row.publish_status === 'queued').length,
      needsReview: rows.filter((row) => row.approval_status === 'needs_review').length,
      ready: rows.filter((row) => row.approval_status === 'ready').length,
    }

    return NextResponse.json({ opportunities: rows, summary })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load SEO opportunities.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { response, user } = await requireLeadAdmin(request)
  if (response) return response

  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : []
  const action = String(body.action || '')

  if (!ids.length || !action) {
    return NextResponse.json({ error: 'An action and at least one id are required.' }, { status: 400 })
  }

  try {
    const results = []
    for (const id of ids) {
      if (action === 'approve') {
        results.push(await updateEntitySeoOpportunity(id, { approval_status: 'approved' }))
      } else if (action === 'reject') {
        results.push(await updateEntitySeoOpportunity(id, { approval_status: 'rejected', publish_status: 'skipped' }))
      } else if (action === 'publish') {
        const row = await getEntitySeoOpportunity(id)
        if (!['approved', 'ready', 'published'].includes(row.approval_status)) {
          results.push(await updateEntitySeoOpportunity(id, { approval_status: 'approved' }))
        }
        results.push(await publishEntitySeoOpportunity(id))
      } else if (action === 'regenerate') {
        results.push(await regenerateEntitySeoOpportunity(id))
      } else {
        return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 })
      }
    }

    await logEvent({
      eventType: 'admin_action',
      actorUserId: user?.id,
      entityType: 'entity_seo_opportunity',
      metadata: { action, count: ids.length },
    })

    return NextResponse.json({ success: true, opportunities: results })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SEO opportunity action failed.' },
      { status: 500 }
    )
  }
}
