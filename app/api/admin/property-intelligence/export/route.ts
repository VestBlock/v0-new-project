export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'
import { listPropertyIntelligence, rowsToCsv, toExportRows } from '@/lib/property-intelligence/repository'

function num(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response

  const { searchParams } = new URL(request.url)
  const result = await listPropertyIntelligence({
    search: searchParams.get('search'),
    city: searchParams.get('city'),
    state: searchParams.get('state'),
    zipCode: searchParams.get('zip'),
    signal: searchParams.get('signal') || 'all',
    vacantOnly: searchParams.get('vacant') === 'true',
    minScore: num(searchParams.get('min_score')),
    limit: num(searchParams.get('limit')) || 1000,
  })

  const csv = rowsToCsv(toExportRows(result.properties))
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="vestblock-property-intelligence-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
