export const LEGACY_OUTREACH_QUARANTINE_CODE = 'legacy_outreach_live_send_quarantined'
export const GOVERNED_OUTREACH_DISPATCH_COMMAND = 'pnpm run outreach:dispatch:live'

export function quarantineLegacyDirectLiveSend({ requested, entry }) {
  if (!requested) return

  const source = String(entry || 'legacy outreach script').trim() || 'legacy outreach script'
  const error = new Error(
    `[${LEGACY_OUTREACH_QUARANTINE_CODE}] Direct live delivery from ${source} is retired because it bypasses the central delivery circuit breaker and throughput governor. ` +
      `Keep using this entry point without its live flag for preview, sourcing, import, or review work. Send approved platform records through ${GOVERNED_OUTREACH_DISPATCH_COMMAND}.`
  )
  error.code = LEGACY_OUTREACH_QUARANTINE_CODE
  throw error
}
