export type OutboundEmailProvider = 'gmail' | 'resend' | 'none'

type ProviderAvailability = {
  gmail: boolean
  resend: boolean
}

type ProviderEnvironment = Readonly<Record<string, string | undefined>>

export function getOutboundProviderAvailability(
  env: ProviderEnvironment = process.env
): ProviderAvailability {
  return {
    gmail: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN),
    resend: Boolean(env.RESEND_API_KEY && env.FROM_EMAIL),
  }
}

function configuredPreference(env: ProviderEnvironment = process.env) {
  const value = String(env.OUTREACH_PROVIDER_PREFERENCE || '').trim().toLowerCase()
  return value === 'gmail' || value === 'resend' ? value : null
}

/**
 * Resend is the default whenever it is configured because it provides signed
 * delivery, bounce, and complaint events to the operating loop. Gmail remains
 * an explicit preference and a failover, not an invisible telemetry bypass.
 */
export function getPreferredOutboundProvider(
  availability: ProviderAvailability,
  env: ProviderEnvironment = process.env
): OutboundEmailProvider {
  const preference = configuredPreference(env)

  if (preference === 'gmail' && availability.gmail) return 'gmail'
  if (preference === 'resend' && availability.resend) return 'resend'
  if (availability.resend) return 'resend'
  if (availability.gmail) return 'gmail'
  return 'none'
}

export function shouldPreferResend(availability: ProviderAvailability) {
  return getPreferredOutboundProvider(availability) === 'resend'
}

export function getConfiguredOutboundProvider(env: ProviderEnvironment = process.env) {
  return getPreferredOutboundProvider(getOutboundProviderAvailability(env), env)
}
