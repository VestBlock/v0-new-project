export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'

import { runDailyLenderSend } from '@/lib/lenders/automation'
import { isCronAuthorized } from '@/lib/system/cronAuth'

function enabled(value: string | null | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase())
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const send = enabled(url.searchParams.get('send'))
  const mode = String(url.searchParams.get('mode') || '').trim().toLowerCase()
  const explicitRecoveryRequest = mode === 'recovery_canary'
  if (send && !explicitRecoveryRequest) {
    return NextResponse.json(
      { error: 'Live canary is fail-closed. Explicitly request mode=recovery_canary together with send=true.' },
      { status: 400 }
    )
  }
  if (send && !enabled(process.env.OUTREACH_CANARY_ENABLED)) {
    return NextResponse.json(
      { error: 'The recovery canary is disabled. Set OUTREACH_CANARY_ENABLED=true before explicitly requesting send=true.' },
      { status: 409 }
    )
  }

  try {
    const result = await runDailyLenderSend(5, {
      dryRun: !send,
      canary: true,
      recoveryExplicitlyRequested: explicitRecoveryRequest,
    })
    const payload = {
      success: result.ok,
      dryRun: !send,
      explicitRecoveryRequest,
      readyToSend: result.sendGateOpen,
      maxRecipients: 5,
      ...result,
    }
    if (send && !result.sendGateOpen) {
      return NextResponse.json({ ...payload, success: false }, { status: 409 })
    }
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Outreach canary failed.' },
      { status: 500 }
    )
  }
}
