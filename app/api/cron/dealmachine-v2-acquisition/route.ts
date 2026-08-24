export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'

import { runN8nDealMachineSourceAcquisition } from '@/lib/n8n/dealMachineSourceAcquisition'
import { isCronAuthorized } from '@/lib/system/cronAuth'

/**
 * Production scheduler for the idempotent source-acquisition core. It runs in
 * bounded four-hour slots and never drafts or delivers outreach; it only keeps
 * the DealMachine cursor moving without requiring an operator in n8n.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })

  try {
    const result = await runN8nDealMachineSourceAcquisition()
    return NextResponse.json({ trigger: 'vercel_cron_fallback', ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'DealMachine source acquisition failed.')
    return NextResponse.json({ ok: false, error: message.slice(0, 500) }, { status: 500 })
  }
}
