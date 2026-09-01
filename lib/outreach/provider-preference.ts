export type OutboundEmailProvider = 'gmail' | 'resend' | 'none'

type ProviderAvailability = {
  gmail: boolean
  resend: boolean
}

function configuredPreference() {
  const value = String(process.env.OUTREACH_PROVIDER_PREFERENCE || '').trim().toLowerCase()
  return value === 'gmail' || value === 'resend' ? value : null
}

/**
 * Resend is the default whenever it is configured because it provides signed
 * delivery, bounce, and complaint events to the operating loop. Gmail remains
 * an explicit preference and a failover, not an invisible telemetry bypass.
 */
export function getPreferredOutboundProvider(availability: ProviderAvailability): OutboundEmailProvider {
  const preference = configuredPreference()

  if (preference === 'gmail' && availability.gmail) return 'gmail'
  if (preference === 'resend' && availability.resend) return 'resend'
  if (availability.resend) return 'resend'
  if (availability.gmail) return 'gmail'
  return 'none'
}

export function shouldPreferResend(availability: ProviderAvailability) {
  return getPreferredOutboundProvider(availability) === 'resend'
}
