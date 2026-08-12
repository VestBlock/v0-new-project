export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import {
  persistDealMachineWebhookEvent,
  readDealMachineWebhookSummary,
  verifyDealMachineWebhook,
} from '@/lib/dealmachine/webhooks'

function isSummaryAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET || process.env.DEALMACHINE_WEBHOOK_SECRET
  if (!configuredSecret && process.env.NODE_ENV !== 'production') return true

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const headerSecret = request.headers.get('x-webhook-secret')?.trim()
  return Boolean(configuredSecret && (bearer === configuredSecret || headerSecret === configuredSecret))
}

export async function GET(request: Request) {
  if (!isSummaryAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  }

  const summary = await readDealMachineWebhookSummary()
  return NextResponse.json({
    ok: true,
    provider: 'dealmachine',
    summary,
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
      databaseId: eventRecord.databaseId,
      rowsReceived: eventRecord.rowsReceived,
      rowsIngested: eventRecord.rowsIngested,
      status: eventRecord.status,
      error: eventRecord.error,
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
