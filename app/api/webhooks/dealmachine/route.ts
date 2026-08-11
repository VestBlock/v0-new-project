export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { checkAdminAccess } from '@/lib/auth/admin'

import {
  persistDealMachineWebhookEvent,
  readDealMachineWebhookSummary,
  verifyDealMachineWebhook,
} from '@/lib/dealmachine/webhooks'

export async function GET() {
  const admin = await checkAdminAccess()
  if (!admin.isAdmin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: admin.user ? 403 : 401 })
  }

  const summary = readDealMachineWebhookSummary()
  return NextResponse.json({
    ok: true,
    provider: 'dealmachine',
    summary: summary
      ? {
          updatedAt: summary.updatedAt || null,
          totalEvents: Number(summary.totalEvents || 0),
          byType: summary.byType || {},
        }
      : null,
  })
}

export async function POST(request: Request) {
  let rawBody = ''

  try {
    rawBody = await request.text()
    const payload = JSON.parse(rawBody || '{}')
    const verification = verifyDealMachineWebhook(rawBody, request.headers)

    if (!verification.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: verification.reason || 'Invalid webhook signature.',
        },
        { status: 401 }
      )
    }

    const eventRecord = await persistDealMachineWebhookEvent({
      payload,
      rawBody,
      headers: request.headers,
      verification,
    })

    return NextResponse.json({
      ok: true,
      received: true,
      eventId: eventRecord.eventId,
      eventType: eventRecord.eventType,
      market: eventRecord.market,
      strategyKey: eventRecord.strategyKey,
      artifactFile: eventRecord.artifactFile,
      verified: eventRecord.verified,
      verificationMode: eventRecord.verificationMode,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed.',
      },
      { status: 500 }
    )
  }
}
