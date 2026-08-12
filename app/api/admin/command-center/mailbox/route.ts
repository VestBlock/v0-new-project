export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getOutlookMailboxStatus, syncOutlookMailbox } from '@/lib/email/outlookMailbox'
import { requireLeadAdmin } from '@/lib/leads/admin-auth'

export async function GET(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response
  const result = await syncOutlookMailbox({ dryRun: true, sinceHours: 24, limit: 10 })
  return NextResponse.json({ status: getOutlookMailboxStatus(), test: result })
}

export async function POST(request: NextRequest) {
  const { response } = await requireLeadAdmin(request)
  if (response) return response
  const body = await request.json().catch(() => ({}))
  const result = await syncOutlookMailbox({
    dryRun: Boolean(body.dryRun),
    sinceHours: Number(body.sinceHours) || 72,
    limit: Number(body.limit) || 50,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 503 })
}
