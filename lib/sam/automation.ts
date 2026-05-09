import { NextResponse } from 'next/server'

function envBool(name: string, fallback = false) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

export function isSamAutomationEnabled() {
  return envBool('LEADS_ENABLE_SAM', false) && !envBool('SAM_AUTOMATION_PAUSED', false) && Boolean(process.env.SAM_GOV_API_KEY)
}

export function buildSamPausedResponse(reason = 'SAM automation is paused until the API key is updated.') {
  return NextResponse.json({
    success: true,
    ok: true,
    paused: true,
    reason,
  })
}
