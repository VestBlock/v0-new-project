export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'

import { runN8nDealMachineSourceAcquisition } from '@/lib/n8n/dealMachineSourceAcquisition'
import { isTrustedN8nSecret } from '@/lib/n8n/operations'

const MAX_REQUEST_BYTES = 1_024

export async function POST(request: Request) {
  if (!isTrustedN8nSecret(request.headers.get('x-is-trusted'), process.env.N8N_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  }
  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody) > MAX_REQUEST_BYTES) {
    return NextResponse.json({ ok: false, error: 'Source acquisition request exceeds the 1 KB limit.' }, { status: 413 })
  }
  if (rawBody.trim() && rawBody.trim() !== '{}') {
    return NextResponse.json({ ok: false, error: 'This endpoint does not accept runtime budget or provider overrides.' }, { status: 400 })
  }
  try {
    const result = await runN8nDealMachineSourceAcquisition()
    return NextResponse.json({
      ...result,
      safeguards: { sourceAcquisition: true, crmEnrollment: false, outreach: false, contentPublishing: false, runtimeOverrides: false },
    }, { status: result.ok ? 200 : 503 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Source acquisition failed.')
    return NextResponse.json({ ok: false, error: message.slice(0, 500) }, { status: 500 })
  }
}
