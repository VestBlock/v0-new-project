export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Resend } from 'resend'

import { recordResendDeliveryEvent } from '@/lib/email/resendDelivery'

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  const apiKey = process.env.RESEND_API_KEY

  if (!webhookSecret || !apiKey) {
    return NextResponse.json(
      { ok: false, error: 'Resend webhook configuration is incomplete.' },
      { status: 503 }
    )
  }

  try {
    const payload = await request.text()
    const providerEventId = request.headers.get('svix-id') || ''
    const timestamp = request.headers.get('svix-timestamp') || ''
    const signature = request.headers.get('svix-signature') || ''

    if (!providerEventId || !timestamp || !signature) {
      return NextResponse.json({ ok: false, error: 'Missing webhook signature headers.' }, { status: 400 })
    }

    const resend = new Resend(apiKey)
    const event = resend.webhooks.verify({
      payload,
      headers: {
        id: providerEventId,
        timestamp,
        signature,
      },
      webhookSecret,
    })
    const result = await recordResendDeliveryEvent({ providerEventId, event })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Invalid Resend webhook.',
      },
      { status: 400 }
    )
  }
}
