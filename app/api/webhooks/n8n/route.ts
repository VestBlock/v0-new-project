export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { acknowledgeN8nWorkflow } from '@/lib/automation/n8n-orchestrator'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const timestamp = request.headers.get('x-vestblock-timestamp') || ''
  const signature = request.headers.get('x-vestblock-signature') || ''
  if (rawBody.length > 64_000) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  try {
    const result = await acknowledgeN8nWorkflow({ rawBody, timestamp, signature })
    return NextResponse.json({ accepted: true, replayed: result.replayed }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[n8n-webhook] acknowledgement rejected', error)
    return NextResponse.json({ error: 'Webhook rejected.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
}
