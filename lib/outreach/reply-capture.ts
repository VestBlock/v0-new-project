import 'server-only'

import { getOutlookMailboxStatus } from '@/lib/email/outlookMailbox'

function envBool(name: string, fallback = false) {
  const value = process.env[name]
  if (!value) return fallback
  return /^(1|true|yes|on)$/i.test(value.trim())
}

export type ReplyCaptureReadiness = {
  ready: boolean
  required: boolean
  overrideEnabled: boolean
  configured: boolean
  mailbox: string
  authMode: string
  missing: string[]
  reason: string | null
}

export function getReplyCaptureReadiness(): ReplyCaptureReadiness {
  const mailbox = getOutlookMailboxStatus()
  const required = envBool('OUTREACH_REQUIRE_REPLY_CAPTURE', true)
  const overrideEnabled = envBool('OUTREACH_ALLOW_WITHOUT_REPLY_CAPTURE', false)
  const ready = !required || mailbox.configured || overrideEnabled

  return {
    ready,
    required,
    overrideEnabled,
    configured: mailbox.configured,
    mailbox: mailbox.mailbox,
    authMode: mailbox.authMode,
    missing: mailbox.missing.map(String),
    reason: ready
      ? null
      : `Reply capture for ${mailbox.mailbox} is disconnected. Missing ${mailbox.missing.join(' and ')}.`,
  }
}
